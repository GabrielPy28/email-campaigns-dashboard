"""
Servicio de logs: registra cada request con fecha, endpoint, status y mensaje.
Se ejecuta en cada petición vía middleware. Los logs se guardan en archivo (vida útil 2 días).
"""
import os
from datetime import datetime
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from loguru import logger

# Guardar logs en archivo: LOG_DIR desde env o /app/logs; rotación diaria; retención 2 días
_log_dir = os.getenv("LOG_DIR", "/app/logs")
os.makedirs(_log_dir, exist_ok=True)
logger.add(
    f"{_log_dir}/requests_{{time:YYYY-MM-DD}}.log",
    rotation="1 day",
    retention="2 days",
    level="INFO",
)


def _format_timestamp() -> str:
    """Fecha en formato dd-mm-YYYY HH:MM."""
    return datetime.utcnow().strftime("%d-%m-%Y %H:%M")


def _message_for_status(status_code: int) -> str:
    """Mensaje de éxito o error según el status de la respuesta."""
    if 200 <= status_code < 300:
        return "OK"
    if 400 <= status_code < 500:
        return "Client error"
    if status_code >= 500:
        return "Server error"
    return "Redirect or other"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware que registra cada solicitud: fecha, endpoint, status y mensaje.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        method = request.method
        path = request.url.path
        endpoint = f"{method} {path}"

        response = await call_next(request)
        status_code = response.status_code
        timestamp = _format_timestamp()
        message = _message_for_status(status_code)

        logger.info(
            "request_log | date={} | endpoint={} | status={} | message={}",
            timestamp,
            endpoint,
            status_code,
            message,
        )
        return response
