from __future__ import absolute_import, unicode_literals

import shutil
import tempfile
from pathlib import Path

from celery import shared_task
from django.core.files.base import File
from django.utils import timezone
from pyspark.sql.functions import col, regexp_replace

from .llm import generate_regex
from .models import Job
from .regex_cache import get_cached_regex, set_cached_regex

_spark = None


def get_spark():
  global _spark
  if _spark is None:
    from pyspark.sql import SparkSession

    _spark = (
      SparkSession.builder
      .appName("RegexProcessor")
      .master("local[*]")
      .getOrCreate()
    )
  return _spark

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


def _process_uploaded_file(job: Job, spark, llm_result: dict) -> None:
  input_path = job.uploaded_file.path
  pattern = llm_result["regex"]
  replacement = llm_result.get("replacement", "")
  target_columns = llm_result.get("target_columns") or []

  job.current_step = "Parsing uploaded file"
  job.save(update_fields=["current_step"])

  df = _read_dataframe(spark, input_path)
  total_rows = df.count()
  total_partitions = df.rdd.getNumPartitions()

  job.total_rows = total_rows
  job.total_partitions = total_partitions
  job.progress = 20
  job.current_step = "Applying regex replacement"
  job.save(update_fields=["total_rows", "total_partitions", "progress", "current_step"])

  processed_df = _apply_regex(df, pattern, replacement, target_columns)
  processed_df.count()

  job.rows_processed = total_rows
  job.partitions_processed = total_partitions
  job.progress = 80
  job.current_step = "Writing processed file"
  job.save(
    update_fields=[
      "rows_processed",
      "partitions_processed",
      "progress",
      "current_step",
    ]
  )

  output_path, temp_dir = _write_dataframe_to_csv(processed_df, str(job.id))

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


@shared_task(bind=True)
def process_job(self, job_id):
  job = Job.objects.get(id=job_id)

  job.status = Job.Status.RUNNING
  job.started_at = timezone.now()
  job.current_step = "Generating regex pattern"
  job.save(update_fields=["status", "started_at", "current_step"])

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

  except Exception as exc:
    job.status = Job.Status.FAILED
    job.error_message = str(exc)
    job.current_step = "Failed during processing"
    job.completed_at = timezone.now()
    job.save(
      update_fields=["status", "error_message", "current_step", "completed_at"]
    )
    raise

  return str(job.id)
