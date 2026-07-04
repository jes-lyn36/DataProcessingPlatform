from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


class JobCreateView(APIView):
  def post(self, request):
    # Get uploaded file
    file = request.FILES["file"]

    # Get other form fields
    prompt = request.data["prompt"]
    replacement = request.data["replacement"]
    columns = request.data["columns"]

    # Save file
    # Create Job
    # Dispatch Celery task

    return Response(
      {
        "jobId": "123",
        "status": "QUEUED",
      },
      status=status.HTTP_202_ACCEPTED,
    )


class JobStatusView(APIView):
  def get(self, request, job_id):
    # Fetch job from database
    # Return 404 if job does not exist

    return Response(
      {
        "jobId": str(job_id),
        "status": "RUNNING",
        "progress": 63,
        "elapsedTime": "00:02:34",
        "rowsProcessed": 1263450,
        "totalRows": 2000000,
        "partitions": "32 / 32",
        "currentStep": "Applying regex replacement on partition 20 of 32",
      },
      status=status.HTTP_200_OK,
    )


class JobResultsView(APIView):
  def get(self, request, job_id):
    # Fetch job from database
    # Return 404 if job does not exist
    # Return 409 if job is not yet complete

    page = int(request.query_params.get("page", 1))
    page_size = int(request.query_params.get("pageSize", 7))

    # Load paginated rows from processed output file
    headers = ["ID", "Name", "Email"]
    rows = [
      {"id": 1, "name": "John Doe", "email": "REDACTED"},
      {"id": 2, "name": "Jane Smith", "email": "REDACTED"},
      {"id": 3, "name": "Alice Brown", "email": "REDACTED"},
      {"id": 4, "name": "Michael Lee", "email": "REDACTED"},
      {"id": 5, "name": "Emily Chen", "email": "REDACTED"},
      {"id": 6, "name": "David Wilson", "email": "REDACTED"},
      {"id": 7, "name": "Sarah Johnson", "email": "REDACTED"},
      {"id": 8, "name": "Chris Taylor", "email": "REDACTED"},
    ]

    total_rows = 2_000_000
    start = (page - 1) * page_size
    paginated_rows = rows[start : start + page_size]

    return Response(
      {
        "jobId": str(job_id),
        "headers": headers,
        "rows": paginated_rows,
        "page": page,
        "pageSize": page_size,
        "totalRows": total_rows,
        "totalPages": (total_rows + page_size - 1) // page_size,
      },
      status=status.HTTP_200_OK,
    )


class JobCancelView(APIView):
  def post(self, request, job_id):
    # Fetch job from database
    # Return 404 if job does not exist
    # Return 409 if job is already complete or failed
    # Revoke Celery task
    # Update job status to CANCELLED

    return Response(
      {
        "jobId": str(job_id),
        "status": "CANCELLED",
      },
      status=status.HTTP_200_OK,
    )
