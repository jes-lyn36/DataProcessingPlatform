from __future__ import absolute_import, unicode_literals

from celery import shared_task
from django.utils import timezone

from .models import Job


@shared_task(bind=True)
def process_job(self, job_id):
    job = Job.objects.get(id=job_id)

    job.status = Job.Status.RUNNING
    job.started_at = timezone.now()
    job.current_step = "Job queued for processing"
    job.save(update_fields=["status", "started_at", "current_step"])

    # TODO: parse file, generate/cache regex, apply replacement, update progress

    return str(job.id)
