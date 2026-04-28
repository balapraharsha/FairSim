from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from api.routes import upload, attack, fix, shap, eli5, whatif, report

app = FastAPI(
    title="FairSim API",
    description="Bias Penetration Testing for AI — Google Solution Challenge 2026",
    version="1.0.0"
)

# CORS — in Cloud Run, CORS_ORIGINS is set via env var to the frontend URL
raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
origins = [o.strip() for o in raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(attack.router, prefix="/api/attack", tags=["attack"])
app.include_router(fix.router,    prefix="/api/fix",    tags=["fix"])
app.include_router(shap.router,   prefix="/api/shap",   tags=["shap"])
app.include_router(eli5.router,   prefix="/api/eli5",   tags=["eli5"])
app.include_router(whatif.router, prefix="/api/whatif", tags=["whatif"])
app.include_router(report.router, prefix="/api/report", tags=["report"])

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "FairSim API", "version": "1.0.0"}

@app.get("/")
def root():
    return {"message": "FairSim API is running. Visit /docs for API reference."}
