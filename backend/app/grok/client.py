"""Small xAI Chat Completions client with strict structured output validation."""

import json
import logging
import os
from urllib.parse import urlparse

import httpx
from pydantic import ValidationError

from app.grok.prompt import SYSTEM_PROMPT
from app.grok.schemas import ParsedReport

logger = logging.getLogger(__name__)


class GrokError(Exception):
    def __init__(self, code: str, message: str, status: int = 502):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


class GrokClient:
    def parse(self, report: str, catalog: dict) -> ParsedReport:
        key = os.getenv("GROK_API_KEY", "").strip()
        if not key:
            raise GrokError("grok_not_configured", "Set GROK_API_KEY; structured POST /incident remains available.", 503)
        base = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1").rstrip("/")
        model = os.getenv("GROK_MODEL", "grok-4.6").strip()
        try:
            timeout = float(os.getenv("GROK_TIMEOUT_SECONDS", "30"))
            parsed_url = urlparse(base)
            _ = parsed_url.port
            if not 0 < timeout <= 120 or not model or parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment:
                raise ValueError("Invalid Grok configuration")
        except ValueError:
            raise GrokError("grok_configuration_error", "Check GROK_BASE_URL (HTTPS), GROK_MODEL and GROK_TIMEOUT_SECONDS (1–120).", 503) from None
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps({"scenario_catalog": catalog, "report": report})},
            ],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "evacroute_incidents", "strict": True, "schema": ParsedReport.model_json_schema(),
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
            raise GrokError("grok_timeout", "Grok timed out; no incidents were applied.", 504) from None
        except httpx.HTTPStatusError as error:
            code = error.response.status_code
            raise GrokError("grok_api_error", f"Grok returned HTTP {code}; check configuration or retry later.",
                            503 if code == 429 else 502) from None
        except httpx.RequestError:
            raise GrokError("grok_unavailable", "Grok could not be reached; no incidents were applied.", 503) from None
        except (httpx.InvalidURL, ValueError):
            raise GrokError("grok_configuration_error", "Check the Grok API URL and configuration.", 503) from None
        try:
            choice = response.json()["choices"][0]
            if choice.get("finish_reason") != "stop":
                raise ValueError("Incomplete response")
            content = choice["message"]["content"]
            if not isinstance(content, str) or len(content) > 65536:
                raise ValueError("Missing or oversized content")
            return ParsedReport.model_validate_json(content)
        except (ValueError, KeyError, IndexError, TypeError, ValidationError):
            raise GrokError("grok_invalid_response", "Grok returned malformed or unsupported incident data; nothing was applied.") from None
