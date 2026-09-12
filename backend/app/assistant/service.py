"""Wires the Grok client to the real scenario/plan state and resolves {{kind:id}} markers
into verified references — the model names an id, this module looks up whether that id
actually exists right now and what its real current label is, never trusting the model's
own wording."""

import re

from app.assistant.client import REFERENCE_PATTERN, GrokClient
from app.assistant.context import build_state_snapshot, resolve_reference
from app.assistant.schemas import AssistantChatResponse, AssistantReference, ChatMessage
from app.models.incidents import IncidentPlan
from app.models.scenario import ScenarioResponse


def ask_assistant(
    message: str,
    history: list[ChatMessage],
    scenario: ScenarioResponse,
    plan: IncidentPlan,
    client: GrokClient,
) -> AssistantChatResponse:
    snapshot = build_state_snapshot(scenario, plan)
    raw_reply = client.chat(message, history, snapshot)

    references: list[AssistantReference] = []
    seen: set[tuple[str, str]] = set()

    def replace(match: re.Match[str]) -> str:
        kind, ref_id = match.group(1), match.group(2)
        label = resolve_reference(kind, ref_id, scenario, plan)
        if label is None:
            # The model pointed at an id that isn't real/current — drop the marker rather
            # than surface a broken reference or a made-up label.
            return ""
        if (kind, ref_id) not in seen:
            seen.add((kind, ref_id))
            references.append(AssistantReference(kind=kind, id=ref_id, label=label))
        return label

    reply = REFERENCE_PATTERN.sub(replace, raw_reply).strip()
    return AssistantChatResponse(reply=reply, references=references)
