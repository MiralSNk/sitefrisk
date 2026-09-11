from fastapi import FastAPI

app = FastAPI(title="sitefrisk-ml")

# TODO: сюда позже переедет инференс дообученной модели (LoRA/QLoRA)
# и endpoint /analyze, принимающий факты от Go-сканера по gRPC.

@app.get("/health")
def health():
    return {"status": "ok", "service": "ml"}