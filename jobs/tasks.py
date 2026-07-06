from __future__ import absolute_import, unicode_literals

from celery import shared_task
from django.utils import timezone

from .llm import generate_regex
from .models import Job
from .regex_cache import get_cached_regex, set_cached_regex


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
      job.current_step = "Applying regex replacement"
      job.save(update_fields=["generated_regex", "current_step"])

      # TODO: parse file, apply regex via PySpark, update progress, write processed_file

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
