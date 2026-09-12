"""Request/response contract for the EvacRoute operations assistant."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ReferenceKind = Literal["vehicle", "incident", "closure", "shelter", "zone"]


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AssistantChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=2000)
    # Prior turns only — the current state snapshot is rebuilt fresh server-side on every
    # request rather than trusted from the client.
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class AssistantReference(BaseModel):
    kind: ReferenceKind
    id: str
    label: str


class AssistantChatResponse(BaseModel):
    reply: str
    references: list[AssistantReference] = Field(default_factory=list)
