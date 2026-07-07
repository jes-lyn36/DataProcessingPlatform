from __future__ import absolute_import, unicode_literals

import os
import shutil
import tempfile
import threading
from pathlib import Path

from celery import shared_task
from celery.signals import worker_process_init
from django.core.files.base import File
from django.db import close_old_connections
from django.utils import timezone
from pyspark.sql.functions import col, regexp_replace

from .llm import generate_regex
from .models import Job
from .regex_cache import get_cached_regex, set_cached_regex
from .spark_progress import make_partition_tap

_spark = None


def _stop_spark() -> None:
  global _spark
  if _spark is not None:
    try:
      _spark.stop()
    except Exception:
      pass
  _spark = None


def _is_spark_alive(spark) -> bool:
  try:
    jsc = spark.sparkContext._jsc
    return jsc is not None and not jsc.sc().isStopped()
  except Exception:
    return False


def get_spark():
  global _spark
  if _spark is not None and not _is_spark_alive(_spark):
    _stop_spark()

  if _spark is None:
    from pyspark.sql import SparkSession

    _spark = (
      SparkSession.builder
      .appName("RegexProcessor")
      .master("local[*]")
      .getOrCreate()
    )
  return _spark


@worker_process_init.connect
def _reset_spark_on_worker_start(**kwargs):
  _stop_spark()

# Figures out which DataFrame columns to run the regex on, using the LLM’s 
# target_columns list and the actual column names from the uploaded file.
def _resolve_target_columns(df_columns: list[str], target_columns: list[str]) -> list[str]:
  if not target_columns:
    return list(df_columns)

  column_lookup = {column.lower(): column for column in df_columns}
  resolved = []

  for target in target_columns:
    actual = column_lookup.get(target.lower())
    if not actual:
      raise ValueError(f"Column '{target}' not found in uploaded file")
    resolved.append(actual)

  return resolved


MAX_PARTITIONS = 200


def _target_partition_count(total_rows: int) -> int:
  if total_rows < 2:
    return 1

  row_based = total_rows // 2
  hardware_cap = (os.cpu_count() or 4) * 2
  return min(row_based, hardware_cap, MAX_PARTITIONS)


def _repartition_for_row_count(df, total_rows: int):
  target_partitions = _target_partition_count(total_rows)
  current_partitions = df.rdd.getNumPartitions()

  if current_partitions > target_partitions:
    df = df.coalesce(target_partitions)
  elif current_partitions < target_partitions:
    df = df.repartition(target_partitions)

  return df, target_partitions


def _read_dataframe(spark, file_path: str):
  lower_path = file_path.lower()

  if lower_path.endswith(".csv"):
    return (
      spark.read
      .option("header", True)
      .option("inferSchema", False)
      .csv(file_path)
    )

  if lower_path.endswith((".xlsx", ".xls")):
    import pandas as pd

    pdf = pd.read_excel(file_path, dtype=str).fillna("")
    return spark.createDataFrame(pdf)

  raise ValueError("Unsupported file format. Upload a CSV or Excel file.")


def _apply_regex(df, pattern: str, replacement: str, target_columns: list[str]):
  columns_to_process = _resolve_target_columns(df.columns, target_columns)

  for column_name in columns_to_process:
    df = df.withColumn(
      column_name,
      regexp_replace(col(column_name), pattern, replacement),
    )

  return df

# Writes a Spark DataFrame to a single CSV file on disk and returns where it was saved.
def _write_dataframe_to_csv(df, job_id: str) -> tuple[str, Path]:
  temp_dir = Path(tempfile.mkdtemp(prefix=f"job_{job_id}_"))
  (
    df.coalesce(1)
    .write.mode("overwrite")
    .option("header", True)
    .csv(str(temp_dir))
  )

  # coalesce(1) should produce one part file; sort for stable ordering if multiple exist.
  part_files = sorted(temp_dir.glob("part-*.csv"))
  if not part_files:
    shutil.rmtree(temp_dir, ignore_errors=True)
    raise RuntimeError("Spark did not produce a processed CSV file")

  # Single CSV output for job.processed_file (all rows are in this one part file).
  return str(part_files[0]), temp_dir


def _calculate_processing_progress(
  rows_processed: int,
  partitions_processed: int,
  total_rows: int,
  total_partitions: int,
) -> int:
  row_pct = int((rows_processed / total_rows) * 70) if total_rows else 0
  partition_pct = (
    int((partitions_processed / total_partitions) * 10) if total_partitions else 0
  )
  return min(95, 20 + row_pct + partition_pct)


def _update_job_progress(job_id, **kwargs) -> None:
  close_old_connections()
  fields = {}
  for field in (
    "progress",
    "rows_processed",
    "partitions_processed",
    "total_rows",
    "total_partitions",
    "current_step",
  ):
    if field in kwargs:
      fields[field] = kwargs[field]

  if fields:
    Job.objects.filter(id=job_id).update(**fields)


def _start_progress_polling(
  job_id,
  rows_acc,
  partitions_acc,
  total_rows,
  total_partitions,
  current_step: str,
):
  stop_event = threading.Event()

  def poll():
    while not stop_event.is_set():
      rows_processed = rows_acc.value
      partitions_processed = partitions_acc.value
      _update_job_progress(
        job_id,
        progress=_calculate_processing_progress(
          rows_processed,
          partitions_processed,
          total_rows,
          total_partitions,
        ),
        current_step=current_step,
        rows_processed=rows_processed,
        total_rows=total_rows,
        partitions_processed=partitions_processed,
        total_partitions=total_partitions,
      )
      stop_event.wait(1)

  thread = threading.Thread(target=poll, daemon=True)
  thread.start()
  return stop_event, thread


def _run_with_progress_tracking(
  job_id,
  spark,
  processed_df,
  total_rows,
  total_partitions,
  current_step: str,
):
  rows_acc = spark.sparkContext.accumulator(0)
  partitions_acc = spark.sparkContext.accumulator(0)
  tap_partition = make_partition_tap(rows_acc, partitions_acc)

  tracked_df = (
    processed_df.rdd
    .mapPartitionsWithIndex(tap_partition)
    .toDF(processed_df.schema)
  )
  tracked_df.cache()

  stop_event, thread = _start_progress_polling(
    job_id,
    rows_acc,
    partitions_acc,
    total_rows,
    total_partitions,
    current_step,
  )

  try:
    tracked_df.count()
  finally:
    stop_event.set()
    thread.join(timeout=2)

  rows_processed = rows_acc.value
  partitions_processed = partitions_acc.value
  _update_job_progress(
    job_id,
    progress=_calculate_processing_progress(
      rows_processed,
      partitions_processed,
      total_rows,
      total_partitions,
    ),
    current_step=current_step,
    rows_processed=rows_processed,
    total_rows=total_rows,
    partitions_processed=partitions_processed,
    total_partitions=total_partitions,
  )

  return rows_processed, partitions_processed, tracked_df


def _process_uploaded_file(job: Job, spark, llm_result: dict) -> None:
  input_path = job.uploaded_file.path
  pattern = llm_result["regex"]
  replacement = llm_result.get("replacement", "")
  target_columns = llm_result.get("target_columns") or []

  current_step = "Parsing uploaded file"
  job.current_step = current_step
  job.progress = 10
  job.save(update_fields=["current_step", "progress"])

  df = _read_dataframe(spark, input_path)
  total_rows = df.count()
  df, total_partitions = _repartition_for_row_count(df, total_rows)

  current_step = "Applying regex replacement"
  job.total_rows = total_rows
  job.total_partitions = total_partitions
  job.rows_processed = 0
  job.partitions_processed = 0
  job.progress = 20
  job.current_step = current_step
  job.save(
    update_fields=[
      "total_rows",
      "total_partitions",
      "rows_processed",
      "partitions_processed",
      "progress",
      "current_step",
    ]
  )

  processed_df = _apply_regex(df, pattern, replacement, target_columns)
  rows_processed, partitions_processed, processed_df = _run_with_progress_tracking(
    job.id,
    spark,
    processed_df,
    total_rows,
    total_partitions,
    current_step,
  )

  current_step = "Writing processed file"
  job.rows_processed = rows_processed
  job.partitions_processed = partitions_processed
  job.current_step = current_step
  job.save(
    update_fields=[
      "rows_processed",
      "partitions_processed",
      "current_step",
    ]
  )

  output_path, temp_dir = _write_dataframe_to_csv(processed_df, str(job.id))
  processed_df.unpersist()

  try:
    original_name = job.uploaded_file.name.rsplit("/", 1)[-1]
    stem = original_name.rsplit(".", 1)[0]
    output_name = f"{stem}_processed.csv"

    with open(output_path, "rb") as processed_file:
      job.processed_file.save(output_name, File(processed_file), save=False)
  finally:
    shutil.rmtree(temp_dir, ignore_errors=True)

  job.progress = 100
  job.status = Job.Status.SUCCESS
  job.current_step = "Completed"
  job.completed_at = timezone.now()
  job.save(
    update_fields=[
      "processed_file",
      "progress",
      "status",
      "current_step",
      "completed_at",
    ]
  )


def _mark_job_failed(job: Job, exc: Exception) -> None:
  job.status = Job.Status.FAILED
  job.error_message = str(exc)
  job.current_step = "Failed during processing"
  job.completed_at = timezone.now()
  job.save(
    update_fields=["status", "error_message", "current_step", "completed_at"]
  )


@shared_task(
  bind=True,
  autoretry_for=(Exception,),
  dont_autoretry_for=(ValueError, Job.DoesNotExist),
  retry_backoff=True,
  retry_backoff_max=300,
  retry_jitter=True,
  max_retries=3,
)
def process_job(self, job_id):
  job = Job.objects.get(id=job_id)

  if job.status == Job.Status.CANCELLED:
    return str(job.id)

  if self.request.retries:
    job.status = Job.Status.RUNNING
    job.current_step = (
      f"Retrying after transient error "
      f"(attempt {self.request.retries + 1}/{self.max_retries + 1})"
    )
    job.progress = 5
    job.error_message = None
    job.save(
      update_fields=["status", "current_step", "progress", "error_message"]
    )
  else:
    job.status = Job.Status.RUNNING
    job.started_at = timezone.now()
    job.current_step = "Generating regex pattern"
    job.progress = 5
    job.save(update_fields=["status", "started_at", "current_step", "progress"])

  prompt = job.natural_language_instruction

  try:
    llm_result = get_cached_regex(prompt)

    if not llm_result:
      llm_result = generate_regex(prompt)
      set_cached_regex(prompt, llm_result)

    job.generated_regex = llm_result["regex"]
    job.save(update_fields=["generated_regex"])

    spark = get_spark()
    _process_uploaded_file(job, spark, llm_result)

  except ValueError as exc:
    _stop_spark()
    _mark_job_failed(job, exc)
    raise
  except Exception as exc:
    _stop_spark()
    if self.request.retries >= self.max_retries:
      _mark_job_failed(job, exc)
    else:
      retry_number = self.request.retries + 1
      job.status = Job.Status.QUEUED
      job.current_step = (
        f"Transient error, scheduling retry "
        f"{retry_number}/{self.max_retries}"
      )
      job.error_message = str(exc)
      job.save(
        update_fields=["status", "current_step", "error_message"]
      )
    raise

  return str(job.id)
