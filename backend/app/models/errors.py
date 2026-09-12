"""Shared API error envelope; legacy detail remains available."""

from typing import Any
from pydantic import BaseModel, ConfigDict


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="allow")
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
    detail: Any
