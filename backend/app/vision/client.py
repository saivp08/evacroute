"""Gemini image-analysis client for incident-photo intake.

Calls Gemini's real generateContent endpoint directly over HTTPS — no SDK dependency,
matching the house style already used for the Anthropic incident parser and the Grok
assistant. The API key lives only in this process's environment; it is never sent to or
readable by the frontend. Structured output uses Gemini's own responseSchema/
responseMimeType mechanism (its equivalent of Anthropic's forced tool-use), so the model
cannot return free-form prose here.
"""

import os
from urllib.parse import urlparse

import httpx
from pydantic import ValidationError

from app.vision.prompt import SYSTEM_PROMPT
from app.vision.schemas import ImageAnalysisResult

# Gemini's structured-output schema format: uppercase type names, no $defs/$ref.
RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "incident_type": {
            "type": "STRING",
            "enum": ["FIRE", "FLOOD", "ROAD_CLOSURE", "CRASH", "MEDICAL_EMERGENCY", "WILDFIRE", "HAZARDOUS_MATERIAL", "OTHER"],
        },
        "severity": {"type": "STRING", "enum": ["LOW", "MODERATE", "HIGH", "CRITICAL"], "nullable": True},
        "description": {"type": "STRING"},
        "affected_road": {"type": "STRING", "nullable": True},
        "estimated_people_affected": {"type": "INTEGER", "nullable": True},
        "environmental_conditions": {"type": "ARRAY", "items": {"type": "STRING"}},
        "confidence": {
            "type": "OBJECT",
            "properties": {
                "incident_type": {"type": "NUMBER"},
                "severity": {"type": "NUMBER"},
            },
            "required": ["incident_type", "severity"],
        },
    },
    "required": ["incident_type", "description", "environmental_conditions", "confidence"],
}


class VisionError(Exception):
    def __init__(self, code: str, message: str, status: int = 502):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


class GeminiClient:
    def analyze(self, image_base64: str, mime_type: str, context_text: str | None) -> ImageAnalysisResult:
        key = os.getenv("GEMINI_API_KEY", "").strip()
        if not key:
            raise VisionError("gemini_not_configured", "Set GEMINI_API_KEY to enable image analysis.", 503)
        base = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
        try:
            timeout = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "30"))
            parsed_url = urlparse(base)
            _ = parsed_url.port
            if not 0 < timeout <= 120 or not model or parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment:
                raise ValueError("Invalid Gemini configuration")
        except ValueError:
            raise VisionError(
                "gemini_configuration_error",
                "Check GEMINI_BASE_URL (HTTPS), GEMINI_MODEL and GEMINI_TIMEOUT_SECONDS (1-120).",
                503,
            ) from None

        text_prompt = SYSTEM_PROMPT
        if context_text:
            text_prompt += f"\n\nAdditional context the reporter typed: {context_text}"

        payload = {
            "contents": [{
                "parts": [
                    {"text": text_prompt},
                    {"inline_data": {"mime_type": mime_type, "data": image_base64}},
                ],
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": RESPONSE_SCHEMA,
            },
        }

        try:
            with httpx.Client(timeout=httpx.Timeout(timeout, connect=min(5, timeout)), follow_redirects=False) as client:
                response = client.post(
                    f"{base}/models/{model}:generateContent",
                    json=payload,
                    headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                )
                response.raise_for_status()
        except httpx.TimeoutException:
            raise VisionError("gemini_timeout", "Image analysis timed out.", 504) from None
        except httpx.HTTPStatusError as error:
            code = error.response.status_code
            raise VisionError("gemini_api_error", "Image analysis is unavailable right now.",
                             503 if code == 429 else 502) from None
        except httpx.RequestError:
            raise VisionError("gemini_unavailable", "Image analysis could not be reached.", 503) from None
        except (httpx.InvalidURL, ValueError):
            raise VisionError("gemini_configuration_error", "Check the image analysis configuration.", 503) from None

        try:
            body = response.json()
            text = body["candidates"][0]["content"]["parts"][0]["text"]
            return ImageAnalysisResult.model_validate_json(text)
        except (KeyError, IndexError, TypeError, ValueError, ValidationError):
            raise VisionError("gemini_invalid_response", "Image analysis returned an unusable response.") from None
