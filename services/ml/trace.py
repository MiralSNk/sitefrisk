"""Разбор и генерация заголовка W3C traceparent."""

from __future__ import annotations

import re
import secrets

_HEX = re.compile(r"\A[0-9a-f]+\Z")


def parse_traceparent(value: str | None) -> tuple[str, str] | None:
    """Разбирает и проверяет заголовок. None, если он невалиден."""
    if not value:
        return None

    parts = value.split("-")
    if len(parts) != 4:
        return None

    version, trace_id, span_id, flags = parts
    if (len(version), len(trace_id), len(span_id), len(flags)) != (2, 32, 16, 2):
        return None
    if not all(_HEX.match(p) for p in parts):
        return None
    if version == "ff":  # запрещено спецификацией
        return None
    if trace_id == "0" * 32 or span_id == "0" * 16:
        return None

    return trace_id, span_id


def random_hex(n_bytes: int) -> str:
    """n случайных байт в hex. secrets, а не random: id уезжает наружу."""
    return secrets.token_hex(n_bytes)


def build_traceparent(trace_id: str, span_id: str) -> str:
    return f"00-{trace_id}-{span_id}-01"


def new_trace(incoming: str | None) -> tuple[str, str]:
    """trace_id сохраняем из входящего заголовка, span_id всегда свой."""
    parsed = parse_traceparent(incoming)
    trace_id = parsed[0] if parsed else random_hex(16)
    return trace_id, random_hex(8)