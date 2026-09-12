"""Grok (xAI) chat client for the EvacRoute operations assistant.

xAI's API is OpenAI-compatible Chat Completions, called directly over HTTPS — no SDK
dependency, matching the house style already used for the Anthropic incident parser
(see app/openai/client.py). The API key lives only in this process's environment; it is
never sent to or readable by the frontend.
"""

import json
import os
import re
from urllib.parse import urlparse

import httpx

from app.assistant.prompt import SYSTEM_PROMPT
from app.assistant.schemas import ChatMessage

REFERENCE_PATTERN = re.compile(r"\{\{(vehicle|incident|closure|shelter|zone):([A-Za-z0-9_.-]+)\}\}")


class AssistantError(Exception):
    def __init__(self, code: str, message: str, status: int = 502):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


class GrokClient:
    def chat(self, message: str, history: list[ChatMessage], state_snapshot: dict) -> str:
        """Returns the raw reply text, markers and all — the caller (service.py) resolves
        {{kind:id}} markers into real labels/references and strips them for display."""
        key = os.getenv("GROK_API_KEY", "").strip()
        if not key:
            raise AssistantError("grok_not_configured", "Set GROK_API_KEY to enable the operations assistant.", 503)
        base = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1").rstrip("/")
        model = os.getenv("GROK_MODEL", "grok-4").strip()
        try:
            timeout = float(os.getenv("GROK_TIMEOUT_SECONDS", "30"))
            parsed_url = urlparse(base)
            _ = parsed_url.port
            if not 0 < timeout <= 120 or not model or parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment:
                raise ValueError("Invalid Grok configuration")
        except ValueError:
            raise AssistantError(
                "grok_configuration_error",
                "Check GROK_BASE_URL (HTTPS), GROK_MODEL and GROK_TIMEOUT_SECONDS (1-120).",
                503,
            ) from None

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": f"Current EvacRoute state snapshot (JSON):\n{json.dumps(state_snapshot)}"},
            *[{"role": turn.role, "content": turn.content} for turn in history],
            {"role": "user", "content": message},
        ]
        payload = {"model": model, "messages": messages, "temperature": 0.2}

        try:
            with httpx.Client(timeout=httpx.Timeout(timeout, connect=min(5, timeout)), follow_redirects=False) as client:
                response = client.post(base + "/chat/completions", json=payload, headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                })
                response.raise_for_status()
        except httpx.TimeoutException:
            raise AssistantError("grok_timeout", "The assistant timed out.", 504) from None
        except httpx.HTTPStatusError as error:
            code = error.response.status_code
            raise AssistantError("grok_api_error", "The assistant is unavailable right now.",
                                503 if code == 429 else 502) from None
        except httpx.RequestError:
            raise AssistantError("grok_unavailable", "The assistant could not be reached.", 503) from None
        except (httpx.InvalidURL, ValueError):
            raise AssistantError("grok_configuration_error", "Check the assistant configuration.", 503) from None

        try:
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Empty response")
            return content
        except (KeyError, IndexError, TypeError, ValueError):
            raise AssistantError("grok_invalid_response", "The assistant returned an unusable response.") from None
