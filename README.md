# Processing Platform

A Django + React web application for uploading CSV or Excel files, converting natural-language pattern descriptions into regex via an LLM, and applying replacements at scale using Celery, Redis, and PySpark. Large uploads/downloads bypass the web process entirely via presigned S3 URLs when object storage is configured.

## Setup & run instructions (local development)

### Prerequisites

- Docker and Docker Compose
- Node.js/npm (for the frontend dev server — see step 3)
- An [OpenAI API key](https://platform.openai.com/api-keys)

### 1. Configure Environment Variables

Before running the application, configure the required environment variables for both local development and production.

```bash
# Always required
DJANGO_SECRET_KEY
OPENAI_API_KEY          # app still boots without it, but job processing fails until set

# Required only when DEBUG=0 (production); have local docker-compose defaults otherwise
DEBUG
DJANGO_ALLOWED_HOSTS
DATABASE_URL            # or POSTGRES_* below, for local docker-compose Postgres
REDIS_URL               # or CELERY_BROKER_URL / CELERY_RESULT_BACKEND / REDIS_CACHE_URL below

# Local docker-compose Postgres fallback (used when DATABASE_URL is blank)
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_HOST
POSTGRES_PORT

# Optional overrides of the REDIS_URL-derived defaults
CELERY_BROKER_URL
CELERY_RESULT_BACKEND
REDIS_CACHE_URL

# Optional tuning (sensible defaults if unset)
REGEX_CACHE_TTL
CELERY_TASK_RETRY_MAX
CELERY_TASK_RETRY_BACKOFF_MAX

# Optional — enables S3 storage + presigned uploads/downloads (unset = local disk)
BUCKET_NAME
BUCKET_REGION
BUCKET_ENDPOINT
BUCKET_ACCESS_KEY
BUCKET_SECRET_KEY
```

### 2. Start the backend stack

```bash
docker-compose up --build
```

This builds a single image (shared by Django and Celery) and starts four containers:

| Container | Runs | Purpose |
|-----------|------|---------|
| `django` | `manage.py runserver 0.0.0.0:8000` | Web API |
| `celery` | `celery -A processing_platform worker` | Async ingestion, LLM calls, Spark processing |
| `pgdb` | Postgres | Job records |
| `redis` | Redis | Celery broker/result backend + LLM regex cache |

No S3 bucket is required locally — uploaded/processed files are stored on disk under `media/`, shared between `django` and `celery` via the bind-mounted project directory.

### 3. Start the frontend dev server

`DJANGO_VITE` runs in `dev_mode` (`processing_platform/settings.py`), so `templates/Main.html` always requests its JS/CSS from a live Vite dev server rather than a prebuilt bundle — this needs to be running alongside step 2, in a separate terminal:

```bash
npm install
npm run dev
```

`vite.config.js` starts the dev server on port 5173 (django-vite's default) and proxies its own `/api` requests to `http://localhost:8000`, so both the Vite dev server and the Django container are talking to the same backend.

### 4. Use the app

Open [http://localhost:8000/main/](http://localhost:8000/main/). The API is available at `/api/jobs/` (see [API endpoints](#api-endpoints)).

## Deployment (production)

The app is split across two providers:

| Component | Host | Notes |
|-----------|------|-------|
| Frontend (React/Vite static build) | Vercel | Root directory `src/ProcessingPlatform`; build command `npm run build:vercel`; output directory `dist` |
| Django web (Gunicorn) | Railway | Serves `/api/*`; needs `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `BUCKET_*` (see below) |
| Celery worker | Railway | Same image/env as the web service; runs `celery -A processing_platform worker` |
| Postgres | Railway | Job records and metadata |
| Redis | Railway | Celery broker/result backend (DB 0) + LLM regex cache (DB 1) |
| Object storage | Railway Bucket (or any S3-compatible bucket) | Uploaded/processed files; required for presigned direct uploads/downloads |

### Frontend → backend routing

The frontend calls relative paths like `/api/jobs/`. `vercel.json` proxies these to the Railway backend so the browser never needs to know the Railway URL directly:

```json
{
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://<your-railway-app>.up.railway.app/api/$1"
    }
  ]
}
```

Two Vite configs exist because the app supports two different builds:

- `vite.config.js` — used by `npm run dev` / `npm run build`; proxies `/api` to `http://localhost:8000` for local development, and outputs into Django's `static/` directory for the `django-vite`-served UI.
- `vite.config.vercel.js` — used by `npm run build:vercel`; outputs a standalone `dist/` build (with its own `index.html`) for Vercel hosting.

### Why large files bypass the proxy chain

Routing a large file upload through `browser → Vercel → Railway → Django` hits Vercel's proxy execution time limit before the transfer + save can complete, returning a `502`. To avoid this, uploads and downloads of the actual file bytes go directly between the browser and the S3-compatible bucket — see [File storage & large uploads](#file-storage--large-uploads) below.

## Architecture

| Layer | Technology | Role |
|-------|------------|------|
| Web API | Django + DRF | Job creation/status/results, presigned URL issuance |
| Task queue | Celery | Async file ingestion, LLM calls, Spark jobs |
| Broker / results | Redis DB 0 | Celery message broker and result backend |
| Cache | Redis DB 1 | LLM-generated regex patterns (keyed by prompt) |
| Processing | PySpark (`local[*]`) | Distributed regex replacement across partitions |
| Object storage | Local disk (dev) or S3-compatible bucket (prod) | Uploaded/processed file storage; presigned upload/download URLs in prod |
| Frontend | React (Vite) | Upload, live progress polling, paginated preview |

Jobs are persisted in PostgreSQL with status (`QUEUED` / `RUNNING` / `SUCCESS` / `FAILED` / `CANCELLED`) and progress fields. The upload endpoint returns immediately with a job ID; all heavy work runs in the Celery worker.

## File storage & large uploads

File handling behaves differently depending on whether S3-compatible object storage is configured (`BUCKET_NAME` env var set):

**Local dev / no bucket configured** — the browser sends a normal `multipart/form-data` `POST /api/jobs/`. Django saves the file to local disk (`MEDIA_ROOT`), and `GET /api/jobs/<id>/download/` streams the processed file back through Django.

**Production (bucket configured)** — the frontend instead:

1. `POST /api/jobs/presigned-upload/` with `{fileName, contentType}` → Django returns a presigned S3 `PUT` URL and object key (no file bytes involved).
2. The browser `PUT`s the file directly to that URL, straight to the bucket — the file never passes through Django, Gunicorn, or the Vercel proxy.
3. `POST /api/jobs/` with `{fileKey, fileName, prompt}` (small JSON, no file body) creates the job, pointing it at the already-uploaded object.
4. `GET /api/jobs/<id>/download/` redirects (`302`) to a presigned S3 `GET` URL instead of streaming the file through Django.

The frontend (`assets/api/jobs.js`) tries the presigned flow first and transparently falls back to the multipart upload if the bucket isn't configured, so the same code works in both environments.

Ingestion inside the Celery worker also never assumes a local `.path` on the uploaded file (which S3-backed files don't have) — `jobs/tasks.py` copies the file from whichever storage backend is active into a local temp file for Spark to read, then deletes it afterward.

**Required env vars for direct S3 upload/download** (in addition to `boto3` / `django-storages[s3]`, already in `requirements.txt`):

| Variable | Purpose |
|----------|---------|
| `BUCKET_NAME` | Bucket name; also acts as the flag that enables S3 storage/presigned URLs |
| `BUCKET_REGION` | Bucket region (`auto` for Railway Buckets) |
| `BUCKET_ENDPOINT` | S3-compatible endpoint URL |
| `BUCKET_ACCESS_KEY` / `BUCKET_SECRET_KEY` | Bucket credentials |

**One manual setup step:** browser-direct uploads require CORS to be enabled on the bucket itself. For a Railway Bucket, run once via the AWS CLI:

```bash
AWS_ACCESS_KEY_ID=<access_key> \
AWS_SECRET_ACCESS_KEY=<secret_key> \
  aws s3api put-bucket-cors \
  --bucket <bucket_name> \
  --endpoint-url https://storage.railway.app \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["PUT", "POST"],
        "AllowedOrigins": ["https://<your-vercel-domain>"],
        "MaxAgeSeconds": 3000
      }
    ]
  }'
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DJANGO_SECRET_KEY` | Always | Django secret key |
| `DEBUG` | No (default `0`) | `1` for local dev |
| `DJANGO_ALLOWED_HOSTS` | When `DEBUG=0` | Comma-separated allowed hosts |
| `DATABASE_URL` | When `DEBUG=0` (or `POSTGRES_*` for local docker-compose) | Postgres connection string |
| `REDIS_URL` | When `DEBUG=0` | Base Redis URL; DB 0 used for Celery, DB 1 for the regex cache |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` / `REDIS_CACHE_URL` | No | Override the `REDIS_URL`-derived defaults |
| `OPENAI_API_KEY` | When `DEBUG=0` | LLM regex generation |
| `BUCKET_NAME` / `BUCKET_REGION` / `BUCKET_ENDPOINT` / `BUCKET_ACCESS_KEY` / `BUCKET_SECRET_KEY` | No (enables S3 storage + presigned URLs when set) | See [File storage & large uploads](#file-storage--large-uploads) |
| `REGEX_CACHE_TTL` | No (default 24h) | LLM regex cache expiry, in seconds |
| `CELERY_TASK_RETRY_MAX` / `CELERY_TASK_RETRY_BACKOFF_MAX` | No (defaults 3 / 300s) | Celery retry policy for `process_job` |

## Redis and Celery configuration

`REDIS_URL` (a single managed Redis instance, e.g. on Railway) is split into two logical databases by appending `/0` and `/1`:

| Setting | Purpose |
|---------|---------|
| `CELERY_BROKER_URL` (Redis DB 0) | Task message broker |
| `CELERY_RESULT_BACKEND` (Redis DB 0) | Task result storage |
| `REDIS_CACHE_URL` (Redis DB 1) | Django cache for LLM regex results |

Locally, `docker-compose.yml` runs its own single-container Redis and Postgres instead.

Celery tasks use late acknowledgment (`CELERY_TASK_ACKS_LATE`) and retry with exponential backoff (up to 3 retries, max 300 s delay, with jitter). Permanent failures such as invalid regex (`ValueError`) are not retried.

## LLM regex generation

`jobs/llm.py` sends the user's natural-language instruction to OpenAI with a few-shot prompt, requesting strict JSON: `{regex, replacement, target_columns}`. Results are cached in Redis DB 1, keyed by a hash of the normalized prompt, so identical instructions skip the LLM call entirely (`jobs/regex_cache.py`).

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

The pipeline is distributed during Spark processing, but several edges collapse back to single-node (or single-job) behaviour. These are deliberate simplifications with known limits.

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

**For large datasets**, using CSV is the better choice. Excel support is provided for convenience on smaller files.

### Single-file CSV output (`coalesce(1)`)

**Current behaviour:** After processing, the DataFrame is written with `coalesce(1)`, forcing all rows into a single partition and producing one `part-*.csv` file. This file is stored as `job.processed_file` and used for pagination and download.

**Why this matters:** Processing runs in parallel across N partitions, but `coalesce(1)` funnels every row through one Spark task at write time. That task becomes a bottleneck and can run out of memory on very large outputs.

**Why it was chosen:** A single CSV file keeps pagination (`_read_csv_page` in `jobs/views.py`) and download simple, so there's no need to merge or scan across multiple part files.

| Approach | Gain | Cost |
|----------|------|------|
| Keep `coalesce(1)` | One file; simple API and download | Write bottleneck; memory risk on huge outputs |
| Write multiple part files | Parallel writes; stays distributed end-to-end | Pagination and download must handle multiple files |
| Store as Parquet | Fast columnar reads at scale | API and frontend changes; not plain CSV download |
| `coalesce(1)` only below a row threshold | Best of both for typical sizes | Extra branching logic |

### Celery worker concurrency (`--concurrency=1`)

**Current behaviour:** the Celery worker runs with `--concurrency=1` (see `docker-compose.yml`), so a single worker process handles exactly one job at a time.

**Why this matters:** each worker process holds one shared, lazily-created `SparkSession` (`_spark` in `jobs/tasks.py`), reused across jobs rather than recreated per job. A JVM process is only really meant to host one active `SparkContext` at a time. Running multiple jobs concurrently inside the same worker would mean those jobs contend for the same `SparkContext`, accumulators, and cached DataFrames, risking cross-job progress-tracking bugs or crashes.

**Why it was chosen:** reusing one `SparkSession` avoids paying the multi-second JVM startup cost on every job, and `local[*]` already spreads a *single* job's partitions across all available CPU cores, so `concurrency=1` doesn't waste hardware within a job, only across simultaneous jobs.

| Approach | Gain | Cost |
|----------|------|------|
| Keep `--concurrency=1` (current) | No cross-job Spark session contention; simple lifecycle | Only one job processes at a time per worker process — others queue in Redis even if CPU is idle |
| Raise `--concurrency` | More jobs run in parallel | Needs an isolated `SparkSession`/JVM per concurrent task, multiplying memory use and per-job startup overhead |
| Scale out with more worker replicas instead | True parallelism across jobs, each with its own isolated JVM | More containers/processes to run and pay for |

**For higher throughput**, scale horizontally (more Celery worker replicas on Railway) rather than raising `--concurrency` within a single process, since each replica gets its own isolated JVM/SparkSession without the contention risk above.

## Other tradeoffs

Smaller deliberate simplifications, called out here rather than given their own section:

| Decision | Why | Tradeoff |
|----------|-----|----------|
| Progress is reported via direct Postgres writes to the `Job` row (`_update_job_progress` in `jobs/tasks.py`), not Celery's `update_state`/task state | One typed, persistent source of truth with richer fields (rows/partitions/step) than Celery's transient `meta` dict; no dependency on the result backend's TTL; the polling API just reads the same `Job` row used everywhere else | Deviates from reporting progress "via Celery state updates surfaced through the polling API"; `celery_task_id` is only used for cancellation (`current_app.control.revoke`), never for status |
| LLM regex cache is keyed only by the normalized prompt, not by the uploaded file's schema (`jobs/regex_cache.py`) | Identical prompts skip repeat LLM calls, saving cost and latency | Reusing the same prompt across files with different column names can hit a cached `target_columns` value that doesn't exist in the new file, raising a `ValueError` instead of transparently regenerating |
| Presigned URL expiry: 600 s for uploads, 300 s for downloads (`jobs/s3_utils.py`) | Limits how long a signed URL remains usable if leaked | A very large upload over a slow connection could expire mid-transfer and need to be retried from the UI |
| Paginated results re-read the processed file from the start on every request (`_read_csv_page` in `jobs/views.py`) | Simple `csv.DictReader` implementation with no separate index to maintain | Each page request is O(n) up to that page, so later pages of very large processed files get progressively slower to load |
| SQLite fallback when `DATABASE_URL`/`POSTGRES_HOST` aren't set | Zero-setup local development without running Postgres | Local dev's database engine differs from production Postgres, so DB-specific behaviour differences won't surface locally |

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
| `POST` | `/api/jobs/` | Create a job — accepts either a multipart `file` + `prompt`, or JSON `{fileKey, fileName, prompt}` for a file already uploaded via a presigned URL; returns job ID (202) |
| `POST` | `/api/jobs/presigned-upload/` | Request a presigned S3 upload URL for `{fileName, contentType}`; 400 if S3 storage isn't configured |
| `GET` | `/api/jobs/<id>/` | Job status and progress |
| `GET` | `/api/jobs/<id>/results/` | Paginated processed data |
| `GET` | `/api/jobs/<id>/download/` | Download processed CSV — redirects to a presigned S3 URL if configured, otherwise streams directly |
| `POST` | `/api/jobs/<id>/cancel/` | Cancel a running job |
