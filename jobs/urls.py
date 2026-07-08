from django.urls import path
from .views import (
  JobCollectionView,
  JobPresignedUploadView,
  JobStatusView,
  JobResultsView,
  JobDownloadView,
  JobCancelView,
)

urlpatterns = [
  # GET /api/jobs/
  # POST /api/jobs/
  path("jobs/", JobCollectionView.as_view(), name="jobs"),

  # POST /api/jobs/presigned-upload/
  path(
    "jobs/presigned-upload/",
    JobPresignedUploadView.as_view(),
    name="job-presigned-upload",
  ),

  # GET /api/jobs/<job_id>/
  path("jobs/<uuid:job_id>/", JobStatusView.as_view(), name="job-status"),

  # GET /api/jobs/<job_id>/results/
  path(
    "jobs/<uuid:job_id>/results/",
    JobResultsView.as_view(),
    name="job-results",
  ),

  # GET /api/jobs/<job_id>/download/
  path(
    "jobs/<uuid:job_id>/download/",
    JobDownloadView.as_view(),
    name="job-download",
  ),

  # POST /api/jobs/<job_id>/cancel/
  path(
    "jobs/<uuid:job_id>/cancel/",
    JobCancelView.as_view(),
    name="cancel-job",
  ),
]
