"""Small OpenAI Chat Completions client with strict structured output validation."""

import json
import logging
import os
from urllib.parse import urlparse

import httpx
from pydantic import ValidationError

from app.openai.prompt import SYSTEM_PROMPT
from app.openai.schemas import ParsedReport

logger = logging.getLogger(__name__)


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
        key = os.getenv("OPEN_AI_API_KEY", "").strip()
        if not key:
            raise OpenAIError("openai_not_configured", "Set OPEN_AI_API_KEY; structured POST /incident remains available.", 503)
        base = os.getenv("OPEN_AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        model = os.getenv("OPEN_AI_MODEL", "gpt-4.1-mini").strip()
        try:
            timeout = float(os.getenv("OPEN_AI_TIMEOUT_SECONDS", "30"))
            parsed_url = urlparse(base)
            _ = parsed_url.port
            if not 0 < timeout <= 120 or not model or parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment:
                raise ValueError("Invalid OpenAI configuration")
        except ValueError:
            raise OpenAIError("openai_configuration_error", "Check OPEN_AI_BASE_URL (HTTPS), OPEN_AI_MODEL and OPEN_AI_TIMEOUT_SECONDS (1–120).", 503) from None
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps({"scenario_catalog": catalog, "report": report})},
            ],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "evacroute_incidents", "strict": True, "schema": extraction_schema(),
            }},
            "stream": False,
        }
        try:
            # No retries, redirects, tools, or report/key logging.
            with httpx.Client(timeout=httpx.Timeout(timeout, connect=min(5, timeout)), follow_redirects=False) as client:
                response = client.post(base + "/chat/completions", json=payload,
                                       headers={"Authorization": f"Bearer {key}"})
                response.raise_for_status()
        except httpx.TimeoutException:
            raise OpenAIError("openai_timeout", "OpenAI timed out; no incidents were applied.", 504) from None
        except httpx.HTTPStatusError as error:
            code = error.response.status_code
            raise OpenAIError("openai_api_error", f"OpenAI returned HTTP {code}; check configuration or retry later.",
                            503 if code == 429 else 502) from None
        except httpx.RequestError:
            raise OpenAIError("openai_unavailable", "OpenAI could not be reached; no incidents were applied.", 503) from None
        except (httpx.InvalidURL, ValueError):
            raise OpenAIError("openai_configuration_error", "Check the OpenAI API URL and configuration.", 503) from None
        try:
            choice = response.json()["choices"][0]
            if choice.get("finish_reason") != "stop" or choice["message"].get("refusal"):
                raise ValueError("Incomplete response")
            content = choice["message"]["content"]
            if not isinstance(content, str) or len(content) > 65536:
                raise ValueError("Missing or oversized content")
            return ParsedReport.model_validate_json(content)
        except (ValueError, KeyError, IndexError, TypeError, ValidationError):
            raise OpenAIError("openai_invalid_response", "OpenAI returned malformed or unsupported incident data; nothing was applied.") from None
