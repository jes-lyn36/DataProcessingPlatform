import csv

from celery import current_app
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Job
from .tasks import process_job


def _public_status(job_status):
  if job_status == Job.Status.SUCCESS:
    return "COMPLETED"
  return job_status


def _format_elapsed(started_at):
  if not started_at:
    return "00:00:00"

  elapsed = timezone.now() - started_at
  total_seconds = max(int(elapsed.total_seconds()), 0)
  hours, remainder = divmod(total_seconds, 3600)
  minutes, seconds = divmod(remainder, 60)
  return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _serialize_job_status(job):
  partitions = (
    f"{job.partitions_processed} / {job.total_partitions}"
    if job.total_partitions
    else "—"
  )

  return {
    "jobId": str(job.id),
    "status": _public_status(job.status),
    "progress": job.progress,
    "elapsedTime": _format_elapsed(job.started_at),
    "rowsProcessed": job.rows_processed,
    "totalRows": job.total_rows,
    "partitions": partitions,
    "currentStep": job.current_step or "Waiting to start",
  }


def _serialize_job_summary(job):
  file_name = ""
  if job.uploaded_file:
    file_name = job.uploaded_file.name.rsplit("/", 1)[-1]

  return {
    "jobId": str(job.id),
    "title": job.natural_language_instruction,
    "fileName": file_name,
    "createdAt": job.created_at.isoformat(),
    "status": _public_status(job.status),
    "progress": job.progress,
  }


def _read_csv_page(file_path, page, page_size, total_rows):
  start = (page - 1) * page_size
  end = start + page_size
  headers = []
  rows = []

  with open(file_path, newline="", encoding="utf-8") as csv_file:
    reader = csv.DictReader(csv_file)
    headers = reader.fieldnames or []

    for index, row in enumerate(reader):
      if index < start:
        continue
      if index >= end:
        break
      rows.append(dict(row))

  return headers, rows, total_rows


@method_decorator(csrf_exempt, name="dispatch")
class JobCollectionView(APIView):
  def get(self, request):
    jobs = Job.objects.order_by("-created_at")
    return Response(
      {"jobs": [_serialize_job_summary(job) for job in jobs]},
      status=status.HTTP_200_OK,
    )

  def post(self, request):
    file = request.FILES.get("file")
    prompt = request.data.get("prompt")

    if not file:
      return Response(
        {"error": "file is required"},
        status=status.HTTP_400_BAD_REQUEST,
      )

    if not prompt:
      return Response(
        {"error": "prompt is required"},
        status=status.HTTP_400_BAD_REQUEST,
      )

    job = Job.objects.create(
      uploaded_file=file,
      natural_language_instruction=prompt,
      status=Job.Status.QUEUED,
    )

    async_result = process_job.delay(str(job.id))
    job.celery_task_id = async_result.id
    job.save(update_fields=["celery_task_id"])

    return Response(
      {
        "jobId": str(job.id),
        "status": job.status,
      },
      status=status.HTTP_202_ACCEPTED,
    )


@method_decorator(csrf_exempt, name="dispatch")
class JobStatusView(APIView):
  def get(self, request, job_id):
    job = get_object_or_404(Job, id=job_id)
    return Response(_serialize_job_status(job), status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class JobResultsView(APIView):
  def get(self, request, job_id):
    job = get_object_or_404(Job, id=job_id)

    if job.status != Job.Status.SUCCESS:
      return Response(
        {"error": "Job is not yet complete"},
        status=status.HTTP_409_CONFLICT,
      )

    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("pageSize", 7))

    if not job.processed_file:
      return Response(
        {
          "jobId": str(job.id),
          "headers": [],
          "rows": [],
          "page": page,
          "pageSize": page_size,
          "totalRows": job.total_rows,
          "totalPages": 0,
        },
        status=status.HTTP_200_OK,
      )

    file_path = job.processed_file.path
    total_rows = job.total_rows

    if file_path.lower().endswith(".csv"):
      headers, rows, total_rows = _read_csv_page(
        file_path,
        page,
        page_size,
        total_rows,
      )
    else:
      headers = []
      rows = []

    total_pages = (total_rows + page_size - 1) // page_size if total_rows else 0

    return Response(
      {
        "jobId": str(job.id),
        "headers": headers,
        "rows": rows,
        "page": page,
        "pageSize": page_size,
        "totalRows": total_rows,
        "totalPages": total_pages,
      },
      status=status.HTTP_200_OK,
    )


@method_decorator(csrf_exempt, name="dispatch")
class JobCancelView(APIView):
  def post(self, request, job_id):
    job = get_object_or_404(Job, id=job_id)

    if job.status in (Job.Status.SUCCESS, Job.Status.FAILED, Job.Status.CANCELLED):
      return Response(
        {"error": "Job cannot be cancelled"},
        status=status.HTTP_409_CONFLICT,
      )

    if job.celery_task_id:
      current_app.control.revoke(job.celery_task_id, terminate=True)

    job.status = Job.Status.CANCELLED
    job.current_step = "Job cancelled"
    job.save(update_fields=["status", "current_step"])

    return Response(
      {
        "jobId": str(job.id),
        "status": _public_status(job.status),
      },
      status=status.HTTP_200_OK,
    )
