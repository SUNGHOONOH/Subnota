from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, inbox, maintenance, memo_chunks, network, schedule, topics
from app.core.config import settings

app = FastAPI(
    title="Subnota Backend",
    version="0.1.0",
    debug=settings.backend_env == "development",
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_headers=["Authorization", "Content-Type"],
    # PATCH: /inbox/sessions/{id}/liked — 빠지면 preflight에서 차단된다.
    allow_methods=["GET", "PATCH", "POST", "OPTIONS"],
    allow_origins=[
        origin.strip()
        for origin in settings.cors_allow_origins.split(",")
        if origin.strip()
    ],
)

app.include_router(health.router)
app.include_router(topics.router)
app.include_router(memo_chunks.router)
app.include_router(network.router)
app.include_router(inbox.router)
app.include_router(schedule.router)
app.include_router(maintenance.router)
