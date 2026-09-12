// One-time data pipeline: pulls real, public Santa Rosa / Sonoma County data and writes
// static snapshots into lib/data/*.json for the frontend to import directly.
//
// This is a dev-time script (run manually with `npm run fetch:data`), not part of the
// shipped app. No secrets required for any of these sources. Re-run to refresh.
//
// Sources:
//  - Census TIGERweb (tract boundaries)              https://tigerweb.geo.census.gov
//  - Census Community Resilience Estimates (pop/vuln) https://www.census.gov/programs-surveys/community-resilience-estimates
//  - FEMA National Shelter System (shelters)          https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/FeatureServer
//  - OpenStreetMap via Overpass (roads, fire stations) https://overpass-api.de
//  - Caltrans PeMS via Zenodo (Kincade evac. traffic)  https://zenodo.org/records/7410114
//  - Kincade Fire facts (hardcoded, cited)            https://en.wikipedia.org/wiki/Kincade_Fire
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "lib", "data");

// Bounding box around Santa Rosa, CA: [xmin(lon), ymin(lat), xmax(lon), ymax(lat)]
const BBOX = [-122.79, 38.4, -122.63, 38.515];
const [xmin, ymin, xmax, ymax] = BBOX;

// Minimal RFC 4180 CSV line parser: handles quoted fields containing commas (the CRE
// dataset's NAME column embeds commas, e.g. "Census Tract 201, Autauga County, Alabama").
function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchZones() {
  const tigerUrl =
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/8/query" +
    `?where=STATE%3D%2706%27+AND+COUNTY%3D%27097%27` +
    `&geometry=${xmin},${ymin},${xmax},${ymax}&geometryType=esriGeometryEnvelope` +
    `&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=GEOID,NAME,BASENAME` +
    `&returnGeometry=true&outSR=4326&f=geojson`;
  const tracts = await fetchJson(tigerUrl);

  const creRes = await fetch(
    "https://www2.census.gov/programs-surveys/demo/datasets/community-resilience/2024/CRE_24_Tract.csv"
  );
  const creText = Buffer.from(await creRes.arrayBuffer()).toString("latin1");
  const creRows = creText.split("\n").filter(Boolean);
  const header = parseCsvLine(creRows[0]);
  const geoIdx = header.indexOf("GEO_ID");
  const popIdx = header.indexOf("POPUNI");
  const vulnIdx = header.indexOf("PRED3_PE");
  const cre = new Map();
  for (const line of creRows.slice(1)) {
    const cols = parseCsvLine(line);
    const geoId = cols[geoIdx]?.replace("1400000US", "");
    if (!geoId) continue;
    cre.set(geoId, {
      population: Number(cols[popIdx]) || 0,
      vulnerablePct: Number(cols[vulnIdx]) || 0,
    });
  }

  const zones = tracts.features.map((f) => {
    const geoId = f.properties.GEOID;
    const stats = cre.get(geoId) ?? { population: 0, vulnerablePct: 0 };
    const ring =
      f.geometry.type === "Polygon"
        ? f.geometry.coordinates[0]
        : f.geometry.coordinates[0][0]; // MultiPolygon: first polygon's outer ring
    const boundary = ring.map(([lon, lat]) => [lat, lon]);
    const status = stats.vulnerablePct >= 30 ? "at-risk" : "clear";
    return {
      id: geoId,
      name: `Tract ${f.properties.BASENAME}`,
      population: stats.population,
      vulnerablePct: stats.vulnerablePct,
      status,
      boundary,
    };
  });

  return zones.sort((a, b) => b.population - a.population);
}

async function fetchShelters() {
  const url =
    "https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/FeatureServer/5/query" +
    `?where=city%3D%27SANTA+ROSA%27+AND+state%3D%27CA%27` +
    `&outFields=shelter_name,address_1,evacuation_capacity,post_impact_capacity,latitude,longitude&f=json`;
  const data = await fetchJson(url);
  return data.features.map((f, i) => {
    const a = f.attributes;
    return {
      id: `shelter-${i}-${a.shelter_name}`.replace(/\s+/g, "-").toLowerCase(),
      name: a.shelter_name,
      address: a.address_1,
      location: [a.latitude, a.longitude],
      capacity: Math.max(a.evacuation_capacity ?? 0, a.post_impact_capacity ?? 0),
    };
  });
}

async function overpass(query) {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
      "User-Agent": "evacroute-hackathon-data-fetch/1.0",
    },
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchRoads() {
  const query = `[out:json][timeout:25];
(
  way["highway"~"motorway|trunk|primary"]["ref"~"CA 12|US 101"](${ymin},${xmin},${ymax},${xmax});
);
out geom;`;
  const data = await overpass(query);
  const byRef = new Map();
  for (const el of data.elements) {
    const ref = el.tags?.ref;
    if (!ref || !el.geometry) continue;
    const coords = el.geometry.map((p) => [p.lat, p.lon]);
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref).push({ id: `road-${el.id}`, name: el.tags.name ?? ref, coordinates: coords });
  }
  return Object.fromEntries(byRef);
}

async function fetchFireStations() {
  const query = `[out:json][timeout:25];
(
  node["amenity"="fire_station"](${ymin},${xmin},${ymax},${xmax});
  way["amenity"="fire_station"](${ymin},${xmin},${ymax},${xmax});
);
out center tags;`;
  const data = await overpass(query);
  return data.elements
    .map((e) => ({
      id: `station-${e.id}`,
      name: e.tags?.name ?? "Fire Station",
      location: [e.lat ?? e.center?.lat, e.lon ?? e.center?.lon],
    }))
    .filter((s) => s.location[0] && s.location[1]);
}

async function fetchTraffic() {
  // Zenodo rate-limits/blocks repeated automated downloads ("unusual traffic") more
  // aggressively than a one-off browser download. If TRAFFIC_XLSX_PATH is set (e.g. after
  // manually downloading the file from https://zenodo.org/records/7410114), read it from
  // disk instead of hitting the network again.
  let buf;
  if (process.env.TRAFFIC_XLSX_PATH) {
    buf = await readFile(process.env.TRAFFIC_XLSX_PATH);
  } else {
    const res = await fetch("https://zenodo.org/records/7410114/files/data_routine_evacuation.xlsx?download=1", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      throw new Error(
        `Zenodo download failed (HTTP ${res.status}). If Zenodo is rate-limiting this host, download ` +
          `data_routine_evacuation.xlsx manually from https://zenodo.org/records/7410114 and re-run with ` +
          `TRAFFIC_XLSX_PATH=/path/to/file.xlsx npm run fetch:data`
      );
    }
    buf = Buffer.from(await res.arrayBuffer());
  }
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  const [header, ...data] = rows;
  const timeIdx = header.indexOf("Time");
  const scenarioIdx = header.indexOf("Scenario");
  const speedIdx = header.indexOf("T Speed (km/h)");
  const flowIdx = header.indexOf("T Flow (veh/h/lane)");

  const evacuation = new Map(); // isoTime -> {speedSum, speedN, flowSum, flowN}
  const routineByMinute = new Map(); // minuteOfDay -> {...}

  for (const row of data) {
    const time = row[timeIdx];
    const scenario = row[scenarioIdx];
    const speed = row[speedIdx];
    const flow = row[flowIdx];
    if (!(time instanceof Date)) continue;

    if (scenario === "Evacuation") {
      const key = time.toISOString();
      const bucket = evacuation.get(key) ?? { speedSum: 0, speedN: 0, flowSum: 0, flowN: 0, time: key };
      if (typeof speed === "number") { bucket.speedSum += speed; bucket.speedN += 1; }
      if (typeof flow === "number") { bucket.flowSum += flow; bucket.flowN += 1; }
      evacuation.set(key, bucket);
    } else if (scenario === "Routine") {
      const minuteOfDay = time.getHours() * 60 + time.getMinutes();
      const bucket = routineByMinute.get(minuteOfDay) ?? { speedSum: 0, speedN: 0, flowSum: 0, flowN: 0, minuteOfDay };
      if (typeof speed === "number") { bucket.speedSum += speed; bucket.speedN += 1; }
      if (typeof flow === "number") { bucket.flowSum += flow; bucket.flowN += 1; }
      routineByMinute.set(minuteOfDay, bucket);
    }
  }

  const toSeries = (map) =>
    [...map.values()].map((b) => ({
        time: b.time,
        minuteOfDay: b.minuteOfDay,
        avgSpeedKmh: b.speedN ? Math.round((b.speedSum / b.speedN) * 10) / 10 : null,
        avgFlowVehPerHr: b.flowN ? Math.round(b.flowSum / b.flowN) : null,
      }));

  return {
    corridor: "US-101, Sonoma County (Kincade Fire evacuation corridor)",
    source: "Caltrans PeMS via Zenodo record 7410114 (data_routine_evacuation.xlsx)",
    detectorCount: 24,
    intervalMinutes: 5,
    evacuation: toSeries(evacuation).sort((a, b) => new Date(a.time) - new Date(b.time)),
    routineByTimeOfDay: toSeries(routineByMinute).sort((a, b) => a.minuteOfDay - b.minuteOfDay),
  };
}

const KINCADE_FIRE_HAZARD = {
  id: "kincade-fire-2019",
  name: "Kincade Fire",
  type: "wildfire",
  // Ignition point, Wikipedia: https://en.wikipedia.org/wiki/Kincade_Fire
  location: [38.792458, -122.780053],
  startedAt: "2019-10-23T21:24:00-07:00",
  containedAt: "2019-11-06T00:00:00-07:00",
  acresBurned: 77758,
  // Approximate radius from acreage (circle-equivalent), for map display only —
  // the real perimeter was elongated, not circular.
  radiusMeters: 10000,
  note: "Historical reference incident: prompted evacuation of ~190,000 Sonoma County residents by Oct 27, 2019, including Santa Rosa.",
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching zones (Census tracts + resilience estimates)...");
  const zones = await fetchZones();

  console.log("Fetching shelters (FEMA NSS)...");
  const shelters = await fetchShelters();

  console.log("Fetching roads (OSM Overpass)...");
  const roads = await fetchRoads();

  console.log("Fetching fire stations (OSM Overpass)...");
  const stations = await fetchFireStations();

  console.log("Fetching + aggregating evacuation traffic (Caltrans PeMS via Zenodo)...");
  const traffic = await fetchTraffic();

  await writeFile(path.join(OUT_DIR, "zones.json"), JSON.stringify(zones, null, 2));
  await writeFile(path.join(OUT_DIR, "shelters.json"), JSON.stringify(shelters, null, 2));
  await writeFile(path.join(OUT_DIR, "roads.json"), JSON.stringify(roads, null, 2));
  await writeFile(path.join(OUT_DIR, "stations.json"), JSON.stringify(stations, null, 2));
  await writeFile(path.join(OUT_DIR, "hazard.json"), JSON.stringify(KINCADE_FIRE_HAZARD, null, 2));
  await writeFile(path.join(OUT_DIR, "traffic.json"), JSON.stringify(traffic, null, 2));

  console.log(`Done. Wrote ${zones.length} zones, ${shelters.length} shelters, ${stations.length} fire stations.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
