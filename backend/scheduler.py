import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore

from config import settings

logging.getLogger("apscheduler.executors.default").setLevel(logging.INFO)

_scheduler_logger = logging.getLogger(__name__)

jobstores = {"default": MemoryJobStore()}
job_defaults = {"coalesce": False, "max_instances": 3}

scheduler = AsyncIOScheduler(
    jobstores=jobstores,
    job_defaults=job_defaults,
    timezone=settings.SCHEDULER_TIMEZONE,
)


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
        _scheduler_logger.info("APScheduler started (tz=%s)", settings.SCHEDULER_TIMEZONE)


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown()
        _scheduler_logger.info("APScheduler shutdown")
