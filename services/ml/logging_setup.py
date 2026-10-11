"""Единая настройка структурного лога сервиса.

Контракт полей (одинаковый во всех сервисах sitefrisk):

    ts       RFC3339 с миллисекундами, UTC
    level    debug|info|warn|error
    service  имя сервиса
    msg      константная строка, без интерполяции
    err      только при warn/error

Остальные поля — доменные, передаются через extra= или bind().
"""

from __future__ import annotations

import json
import logging
import os
import sys
from contextvars import ContextVar, Token
from datetime import datetime, timezone
from typing import Any

# Поля, которые подмешиваются в каждую запись.
#
# ContextVar, а не threading.local: каждый запрос в Starlette выполняется
# в своей asyncio-задаче, а задача получает свою копию контекста. Значит
# привязка в middleware автоматически видна только внутри этого запроса
# и не протекает в соседние — с threading.local в async так не выйдет.
_context: ContextVar[dict[str, Any]] = ContextVar("log_context", default={})

# Стандартные атрибуты LogRecord — всё, что не из этого списка,
# пользователь передал через extra= и должно попасть в JSON.
_RESERVED = frozenset(
    """args asctime created exc_info exc_text filename funcName levelname
    levelno lineno module msecs message msg name pathname process
    processName relativeCreated stack_info thread threadName taskName""".split()
)

# Python знает WARNING и CRITICAL, наш контракт — нет (анлак, доп код писать... лень оч).
_LEVELS = {
    "DEBUG": "debug",
    "INFO": "info",
    "WARNING": "warn",
    "ERROR": "error",
    "CRITICAL": "error",
}


def bind(**fields: Any) -> Token:
    """Добавляет поля в контекст. Возвращает токен для отката."""
    merged = {**_context.get(), **fields}
    return _context.set(merged)


def unbind(token: Token) -> None:
    """Откатывает контекст к состоянию до соответствующего bind()."""
    _context.reset(token)


def context() -> dict[str, Any]:
    """Текущие контекстные поля (копия)."""
    return dict(_context.get())


class JsonFormatter(logging.Formatter):
    """Форматтер, печатающий одну JSON-строку на запись."""

    def __init__(self, service: str) -> None:
        super().__init__()
        self._service = service

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created, tz=timezone.utc)

        entry: dict[str, Any] = {
            "ts": ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z",
            "level": _LEVELS.get(record.levelname, record.levelname.lower()),
            "service": self._service,
            "msg": record.getMessage(),
        }

        entry.update(_context.get())

        # extra= попадает прямо в __dict__ записи
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                entry[key] = value

        if record.exc_info:
            entry["err"] = self.formatException(record.exc_info)

        # default=str — чтобы UUID, datetime и прочее не валили сериализацию.
        # ensure_ascii=False — чтобы русский текст не превращался в \uXXXX.
        return json.dumps(entry, default=str, ensure_ascii=False)


def setup(service: str) -> None:
    """Настраивает корневой логгер. Вызывать один раз при старте."""
    level = os.getenv("LOG_LEVEL", "info").upper()
    if level == "WARN":
        level = "WARNING"

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service))

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level, logging.INFO))

    # uvicorn ставит свои обработчики со своим форматом. Снимаем их и
    # заставляем всплывать до корня — иначе половина вывода сервиса
    # останется не-JSON, и jq по ней работать не будет.
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True