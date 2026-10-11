import logging

from fastapi import FastAPI, Request

import logging_setup
from trace import build_traceparent, new_trace

logging_setup.setup("ml")
log = logging.getLogger("ml")

app = FastAPI(title="sitefrisk-ml")

# TODO: сюда позже переедет инференс дообученной модели (LoRA/QLoRA)
# и endpoint /analyze, принимающий факты от Go-сканера по gRPC.


@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    trace_id, span_id = new_trace(request.headers.get("traceparent"))
    token = logging_setup.bind(trace_id=trace_id, span_id=span_id)
    try:
        log.info("request started", extra={"method": request.method, "path": request.url.path})
        response = await call_next(request)
        log.info("request finished", extra={"method": request.method,
                                            "path": request.url.path,
                                            "status": response.status_code})
        response.headers["traceparent"] = build_traceparent(trace_id, span_id)
        return response
    finally:
        # Откат обязателен: без него привязка переживёт запрос.
        logging_setup.unbind(token)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml"}