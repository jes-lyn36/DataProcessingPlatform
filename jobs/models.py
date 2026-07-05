from django.db import models
import uuid

class Job(models.Model):
  class Status(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    RUNNING = "RUNNING", "Running"
    SUCCESS = "SUCCESS", "Success"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"

  id = models.UUIDField(
    primary_key=True,
    default=uuid.uuid4,
    editable=False
  )

  uploaded_file = models.FileField(
    upload_to="uploads/"
  )

  processed_file = models.FileField(
    upload_to="processed/",
    null=True,
    blank=True
  )

  natural_language_instruction = models.TextField()

  generated_regex = models.TextField(
    blank=True,
    null=True
  )

  status = models.CharField(
    max_length=20,
    choices=Status.choices,
    default=Status.QUEUED
  )

  progress = models.PositiveIntegerField(default=0)

  rows_processed = models.PositiveBigIntegerField(default=0)
  total_rows = models.PositiveBigIntegerField(default=0)

  current_step = models.CharField(
    max_length=255,
    blank=True,
    default=""
  )

  partitions_processed = models.PositiveIntegerField(default=0)
  total_partitions = models.PositiveIntegerField(default=0)

  error_message = models.TextField(
    blank=True,
    null=True
  )

  celery_task_id = models.CharField(
    max_length=255,
    blank=True,
    null=True
  )

  created_at = models.DateTimeField(auto_now_add=True)
  started_at = models.DateTimeField(blank=True, null=True)
  completed_at = models.DateTimeField(blank=True, null=True)
  updated_at = models.DateTimeField(auto_now=True)

  def __str__(self):
    return f"{self.id} - {self.status}"