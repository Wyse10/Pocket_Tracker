from pathlib import Path
import json
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from .database import Base, engine
from .routes import router


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        extra_data = getattr(record, "extra_data", None)
        if isinstance(extra_data, dict):
            payload.update(extra_data)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True)


def configure_structured_logging() -> logging.Logger:
    logger = logging.getLogger("pocket_tracker")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)

    logger.propagate = False
    return logger


app_logger = configure_structured_logging()

app = FastAPI(title="Pocket Tracker")


def ensure_schema_updates() -> None:
    inspector = inspect(engine)
    if "transactions" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "description" not in existing_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN description VARCHAR"))

Base.metadata.create_all(bind=engine)
ensure_schema_updates()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.include_router(router)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start_time = time.perf_counter()

    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        app_logger.info(
            "request.completed",
            extra={
                "extra_data": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "query": request.url.query,
                    "status_code": response.status_code,
                    "duration_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "client_ip": request.client.host if request.client else None,
                }
            },
        )
        return response
    except Exception:
        app_logger.exception(
            "request.failed",
            extra={
                "extra_data": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "query": request.url.query,
                    "duration_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "client_ip": request.client.host if request.client else None,
                }
            },
        )
        raise


