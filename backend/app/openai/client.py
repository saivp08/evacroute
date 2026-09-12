"""Small Anthropic Messages API client with strict structured output validation.

Was an OpenAI Chat Completions client; swapped to Anthropic per request. Kept the
OpenAIClient/OpenAIError names and the app/openai/ module path as-is — renaming those is a
separate, larger change than the ANTHROPIC_API_KEY swap that was actually asked for, and
app/main.py, app/openai/service.py, and app/openai/manual.py all import these names.
"""

import json
import logging
import os
from urllib.parse import urlparse

import httpx
from pydantic import ValidationError

from app.openai.prompt import SYSTEM_PROMPT
from app.openai.schemas import ParsedReport

logger = logging.getLogger(__name__)

TOOL_NAME = "extract_incidents"


def extraction_schema() -> dict:
    """Require every property on the wire, including nullable optional fields."""
    schema = ParsedReport.model_json_schema()

    def make_strict(node):
        if isinstance(node, dict):
            node.pop("default", None)
            if node.get("type") == "object":
                node["required"] = list(node["properties"])
                node["additionalProperties"] = False
            for value in node.values():
                make_strict(value)
        elif isinstance(node, list):
            for value in node:
                make_strict(value)

    make_strict(schema)
    return schema


class OpenAIError(Exception):
    def __init__(self, code: str, message: str, status: int = 502):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


class OpenAIClient:
    def parse(self, report: str, catalog: dict) -> ParsedReport:
        key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not key:
            raise OpenAIError("anthropic_not_configured", "Set ANTHROPIC_API_KEY; structured POST /incident remains available.", 503)
        base = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1").rstrip("/")
        model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001").strip()
        try:
            timeout = float(os.getenv("ANTHROPIC_TIMEOUT_SECONDS", "30"))
            parsed_url = urlparse(base)
            _ = parsed_url.port
            if not 0 < timeout <= 120 or not model or parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment:
                raise ValueError("Invalid Anthropic configuration")
        except ValueError:
            raise OpenAIError(
                "anthropic_configuration_error",
                "Check ANTHROPIC_BASE_URL (HTTPS), ANTHROPIC_MODEL and ANTHROPIC_TIMEOUT_SECONDS (1-120).",
                503,
            ) from None

        # Structured output via forced tool use — Anthropic's equivalent of OpenAI's
        # response_format=json_schema: the model must call this exact tool, and its
        # validated `input` is the extracted report (see schemas.ParsedReport).
        payload = {
            "model": model,
            "max_tokens": 4096,
            "system": SYSTEM_PROMPT,
            "messages": [
                {"role": "user", "content": json.dumps({"scenario_catalog": catalog, "report": report})},
            ],
            "tools": [{
                "name": TOOL_NAME,
                "description": "Return the extracted incident events matching the schema.",
                "input_schema": extraction_schema(),
            }],
            "tool_choice": {"type": "tool", "name": TOOL_NAME},
        }
        try:
            # No retries, redirects, or report/key logging.
            with httpx.Client(timeout=httpx.Timeout(timeout, connect=min(5, timeout)), follow_redirects=False) as client:
                response = client.post(base + "/messages", json=payload, headers={
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                })
                response.raise_for_status()
        except httpx.TimeoutException:
            raise OpenAIError("anthropic_timeout", "Anthropic timed out; no incidents were applied.", 504) from None
        except httpx.HTTPStatusError as error:
            code = error.response.status_code
            raise OpenAIError("anthropic_api_error", f"Anthropic returned HTTP {code}; check configuration or retry later.",
                            503 if code == 429 else 502) from None
        except httpx.RequestError:
            raise OpenAIError("anthropic_unavailable", "Anthropic could not be reached; no incidents were applied.", 503) from None
        except (httpx.InvalidURL, ValueError):
            raise OpenAIError("anthropic_configuration_error", "Check the Anthropic API URL and configuration.", 503) from None
        try:
            body = response.json()
            if body.get("stop_reason") != "tool_use":
                raise ValueError("Incomplete response")
            tool_block = next(
                block for block in body["content"]
                if block.get("type") == "tool_use" and block.get("name") == TOOL_NAME
            )
            return ParsedReport.model_validate(tool_block["input"])
        except (ValueError, KeyError, IndexError, TypeError, StopIteration, ValidationError):
            raise OpenAIError("anthropic_invalid_response", "Anthropic returned malformed or unsupported incident data; nothing was applied.") from None
