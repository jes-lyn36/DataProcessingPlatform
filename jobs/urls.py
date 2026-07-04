from django.urls import path
from .views import (
  JobCreateView,
  JobStatusView,
  JobResultsView,
  JobCancelView,
)

urlpatterns = [
  # POST /api/jobs/
  path("jobs/", JobCreateView.as_view(), name="create-job"),

  # GET /api/jobs/<job_id>/
  path("jobs/<uuid:job_id>/", JobStatusView.as_view(), name="job-status"),

  # GET /api/jobs/<job_id>/results/
  path(
    "jobs/<uuid:job_id>/results/",
    JobResultsView.as_view(),
    name="job-results",
  ),

  # POST /api/jobs/<job_id>/cancel/
  path(
    "jobs/<uuid:job_id>/cancel/",
    JobCancelView.as_view(),
    name="cancel-job",
  ),
]