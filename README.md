# Processing Platform

A Django + React web application for uploading CSV or Excel files, converting natural-language pattern descriptions into regex via an LLM, and applying replacements at scale using Celery, Redis, and PySpark.

## Quick start

```bash
export OPENAI_API_KEY=your_key_here
docker-compose up --build
```

Open [http://localhost:8000/main/](http://localhost:8000/main/) to use the UI. The API is available at `/api/jobs/`.

## Architecture

| Layer | Technology | Role |
|-------|------------|------|
| Web API | Django + DRF | Upload, job tracking, paginated results |
| Task queue | Celery | Async file parsing, LLM calls, Spark jobs |
| Broker / results | Redis DB 0 | Celery message broker and result backend |
| Cache | Redis DB 1 | LLM-generated regex patterns (keyed by prompt) |
| Processing | PySpark (`local[*]`) | Distributed regex replacement across partitions |
| Frontend | React (Vite) | Upload, live progress polling, paginated preview |

Jobs are persisted in PostgreSQL with status (`QUEUED` / `RUNNING` / `SUCCESS` / `FAILED` / `CANCELLED`) and progress fields. The upload endpoint returns immediately with a job ID; all heavy work runs in the Celery worker.

## Redis and Celery configuration

Configured in `processing_platform/settings.py` and `docker-compose.yml`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | Task message broker |
| `CELERY_RESULT_BACKEND` | `redis://redis:6379/0` | Task result storage |
| `REDIS_CACHE_URL` | `redis://redis:6379/1` | Django cache for LLM regex results |
| `REGEX_CACHE_TTL` | 24 hours (default) | Cache expiry for generated patterns |

Celery tasks use late acknowledgment (`CELERY_TASK_ACKS_LATE`) and retry with exponential backoff (up to 3 retries, max 300 s delay, with jitter). Permanent failures such as invalid regex (`ValueError`) are not retried.

## Partitioning and parallelism

Spark runs in `local[*]` mode inside the Celery worker, using all available CPU cores on a single node. Partition count is chosen in `jobs/tasks.py`:

```
target_partitions = min(total_rows // 2, cpu_count * 2, 200)
```

- **Row-based scaling** — roughly one partition per two rows, so larger datasets get more parallelism.
- **Hardware cap** — `cpu_count * 2` avoids creating far more partitions than cores can usefully process.
- **Upper bound (200)** — prevents partition overhead from dominating on very large files.

After reading, the DataFrame is repartitioned (or coalesced) to this target. Progress is tracked per partition using Spark accumulators and surfaced through the job polling API.

Regex replacement itself is a row-local `regexp_replace` transformation, so it parallelises cleanly across partitions without shuffles.

## Scaling tradeoffs

The pipeline is distributed during Spark processing, but two edges collapse back to single-node behaviour. These are deliberate simplifications with known limits.

### Excel ingestion

**Current behaviour:** Excel files (`.xlsx`, `.xls`) are loaded entirely into memory with `pandas.read_excel()`, then converted to a Spark DataFrame.

**Why this matters:** Unlike CSV, Excel is a zipped XML format that cannot be split into partitions at read time. The entire workbook must be parsed by one process before Spark sees the data. For files with millions of rows, this can exhaust worker memory even though the Spark transformation step would scale fine.

**CSV path (scalable):** `spark.read.csv()` streams the file and distributes partitions across cores without loading everything into a single process.

| Approach | Gain | Cost |
|----------|------|------|
| Keep as-is | Simple; works for small/medium Excel files | Not suitable for very large Excel uploads |
| Reject oversized Excel files | Prevents OOM; clear error to user | Users must convert to CSV manually |
| Stream Excel → temp CSV (`openpyxl` read-only) | Spark then reads CSV in partitions | Extra conversion step; legacy `.xls` is harder to stream |
| CSV-only for large datasets | Strongest scaling story | Worse UX for Excel users |

**Recommendation for large datasets:** use CSV. Excel support is provided for convenience on smaller files.

### Single-file CSV output (`coalesce(1)`)

**Current behaviour:** After processing, the DataFrame is written with `coalesce(1)`, forcing all rows into a single partition and producing one `part-*.csv` file. This file is stored as `job.processed_file` and used for pagination and download.

**Why this matters:** Processing runs in parallel across N partitions, but `coalesce(1)` funnels every row through one Spark task at write time. That task becomes a bottleneck and can run out of memory on very large outputs.

**Why it was chosen:** A single CSV file keeps pagination (`_read_csv_page` in `jobs/views.py`) and download simple — no need to merge or scan across multiple part files.

| Approach | Gain | Cost |
|----------|------|------|
| Keep `coalesce(1)` | One file; simple API and download | Write bottleneck; memory risk on huge outputs |
| Write multiple part files | Parallel writes; stays distributed end-to-end | Pagination and download must handle multiple files |
| Store as Parquet | Fast columnar reads at scale | API and frontend changes; not plain CSV download |
| `coalesce(1)` only below a row threshold | Best of both for typical sizes | Extra branching logic |

**Recommendation for production:** drop `coalesce(1)` for large jobs, write multiple part files, and update the results reader to page across them in order. For this assessment, the single-file approach is a documented trade-off.

## Large dataset testing

The pipeline has been exercised with a **2,000,000-row CSV** (`people-2000000.csv`). The CSV read path, partition strategy, and Spark `regexp_replace` transformation complete without blocking the web process. Progress is reported via partition-level accumulators.

To reproduce:

1. Upload a large CSV via the UI or `POST /api/jobs/`.
2. Poll `GET /api/jobs/<job_id>/` for progress.
3. When complete, page through results at `GET /api/jobs/<job_id>/results/?page=1&pageSize=7`.

## Regex validation

LLM-generated patterns are validated before use:

1. Syntax check via `re.compile()`
2. Length cap (300 characters)
3. Catastrophic backtracking probe via the `regex` library with a 100 ms timeout on adversarial inputs

Validation runs in Python; the actual replacement at scale uses Spark's JVM regex engine (`regexp_replace`). The probe rejects dangerous patterns before they reach Spark.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/jobs/` | List all jobs |
| `POST` | `/api/jobs/` | Upload file + prompt; returns job ID (202) |
| `GET` | `/api/jobs/<id>/` | Job status and progress |
| `GET` | `/api/jobs/<id>/results/` | Paginated processed data |
| `GET` | `/api/jobs/<id>/download/` | Download processed CSV |
| `POST` | `/api/jobs/<id>/cancel/` | Cancel a running job |
