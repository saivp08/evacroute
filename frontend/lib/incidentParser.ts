// Lightweight rule-based parser for natural-language incident reports.
// Not an LLM integration (no Grok/API key in scope) — good enough for a hackathon demo
// to recognize the road/zone/severity keywords that drive the replanning visualization.
import type { ParsedIncident, Zone } from "./types";

const ROAD_PATTERN = /\b(highway|hwy|route|ca|us)\s*-?\s*(\d+)\b/gi;

export function parseIncident(text: string, zones: Zone[]): ParsedIncident {
  const lower = text.toLowerCase();

  const blockedRoadRefs: string[] = [];
  if (/block|closed|debris|downed|impassable/i.test(lower)) {
    let match: RegExpExecArray | null;
    ROAD_PATTERN.lastIndex = 0;
    while ((match = ROAD_PATTERN.exec(text)) !== null) {
      blockedRoadRefs.push(`${match[1]} ${match[2]}`);
    }
  }

  const zoneName = zones.find((z) => lower.includes(z.name.toLowerCase()))?.name;

  let type: ParsedIncident["type"] = "general";
  if (/injur|casualt|medical/i.test(lower)) type = "injuries";
  else if (blockedRoadRefs.length > 0) type = "road-blocked";
  else if (/fire shift|spread|moving|wind shift/i.test(lower)) type = "fire-spread";

  let severity: ParsedIncident["severity"] = "medium";
  if (/injur|casualt|critical|fatal/i.test(lower)) severity = "critical";
  else if (/block|closed|debris|impassable/i.test(lower)) severity = "high";
  else if (/shift|spread|moving/i.test(lower)) severity = "medium";
  else severity = "low";

  return { type, description: text, severity, zoneName, blockedRoadRefs };
}
