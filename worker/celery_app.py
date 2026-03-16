import os

from celery import Celery


REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

# Aseguramos que se registren las tasks del paquete worker
celery.autodiscover_tasks(["worker"])

celery.conf.timezone = "UTC"
celery.conf.beat_schedule = {
    "process-email-queue-every-minute": {
        "task": "worker.tasks.process_email_queue_task",
        "schedule": 60.0,  # cada 60 segundos
    }
}

