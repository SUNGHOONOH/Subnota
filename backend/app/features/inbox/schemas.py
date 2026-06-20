from typing import Any

from pydantic import BaseModel, Field


class InboxSessionCreateRequest(BaseModel):
    client_id: str | None = Field(default=None, max_length=128)
    url: str | None = Field(default=None, max_length=4096)
    title: str | None = Field(default=None, max_length=500)
    raw_shared_text: str | None = Field(default=None, max_length=8000)
    selected_text: str | None = Field(default=None, max_length=8000)
    user_note: str | None = Field(default=None, max_length=4000)


class InboxSessionAnalyzeRequest(BaseModel):
    session_id: str


class InboxSessionListResponse(BaseModel):
    items: list[dict[str, Any]]


class InboxSummaryIndexRequest(BaseModel):
    user_id: str
    limit: int = Field(100, ge=1, le=500)


class InboxSummaryIndexResponse(BaseModel):
    status: str
    user_id: str
    indexed_count: int
    model: str
