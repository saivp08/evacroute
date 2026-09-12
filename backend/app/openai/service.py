"""Validate and resolve extracted references before the shared batch transaction."""

import logging
import re

from pydantic import ValidationError

from app.data.incidents import TargetNotFound
from app.openai.client import OpenAIClient, OpenAIError
from app.openai.schemas import ParseResponse, ParsedReport
from app.models.incidents import IncidentRequest
from app.optimization.planning import apply_incidents

logger = logging.getLogger(__name__)


def catalog_for(scenario):
    return {
        "zones": [{"id": z.id, "name": z.name} for z in scenario.zones],
        "shelters": [{"id": s.id, "name": s.name} for s in scenario.shelters],
        "road_names": sorted({name for road in scenario.roads for name in road.name.split("; ")
                              if name != "Unnamed road"}),
    }


def reference_key(value: str) -> str:
    return " ".join(re.sub(r"[-.,]", " ", value.casefold()).split())


def resolve_site(value, sites):
    key = reference_key(value)
    matches = [site for site in sites if key in {
        reference_key(site.id), reference_key(site.name), reference_key(site.name.split(" — ")[0])
    }]
    if len(matches) != 1:
        raise TargetNotFound(f"Unresolved or ambiguous scenario location: {value}")
    return matches[0]


def resolve_road_name(value, scenario):
    abbreviations = {"avenue": "ave", "road": "rd", "street": "st", "boulevard": "blvd",
                     "highway": "hwy", "drive": "dr", "lane": "ln", "court": "ct"}
    def key(name):
        return " ".join(abbreviations.get(word, word) for word in reference_key(name).split())
    names = catalog_for(scenario)["road_names"]
    matches = [name for name in names if key(name) == key(value)]
    if len(matches) != 1:
        raise TargetNotFound(f"Unresolved or ambiguous road name: {value}; use a name from GET /scenario")
    return matches[0]


def parse_and_apply(report, graph, scenario, state, client: OpenAIClient):
    logger.info("Emergency report received (%d characters)", len(report))
    try:
        result = client.parse(report, catalog_for(scenario))
        # Revalidate even injected/test clients; never accept raw model output.
        parsed = ParsedReport.model_validate(result.model_dump() if isinstance(result, ParsedReport) else result)
    except ValidationError:
        logger.warning("OpenAI parsing failed: invalid schema")
        raise OpenAIError("openai_invalid_response", "OpenAI returned malformed or unsupported incident data.") from None
    except OpenAIError as error:
        logger.warning("OpenAI parsing failed: %s", error.code)
        raise
    logger.info("OpenAI parsing succeeded: %d events (%s)", len(parsed.events),
                ", ".join(event.type for event in parsed.events))
    requests = []
    notes = list(parsed.notes)
    try:
        for index, event in enumerate(parsed.events):
            if event.evidence not in report:
                raise OpenAIError("openai_ungrounded_event", "An event's evidence was not present in the report; nothing was applied.")
            if event.certainty == "uncertain":
                notes.append(f"Event {index + 1} was not applied because it is uncertain.")
                continue
            target = {}
            if event.road_name is not None:
                target["road_name"] = resolve_road_name(event.road_name, scenario)
            elif event.zone is not None:
                target["zone"] = resolve_site(event.zone, scenario.zones).id
            elif event.shelter is not None:
                shelter = resolve_site(event.shelter, scenario.shelters)
                target.update(latitude=shelter.latitude, longitude=shelter.longitude)
            else:
                target.update(latitude=event.latitude, longitude=event.longitude)
            if event.injuries is not None:
                target["injuries"] = event.injuries
            if event.severity is None:
                notes.append(f"Event {index + 1}: severity was unspecified; applied medium demo severity.")
            requests.append(IncidentRequest(type=event.type, severity=event.severity or "medium", **target))
        _, plan = apply_incidents(graph, scenario, state, requests)
    except TargetNotFound:
        logger.warning("Parsed event location resolution failed; batch not applied")
        raise
    except OpenAIError as error:
        logger.warning("OpenAI event validation failed: %s", error.code)
        raise
    return ParseResponse(**plan.model_dump(), original_report=report,
                         parsed_events=parsed.events, applied_events=requests, notes=notes)
