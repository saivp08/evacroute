# Committed demo snapshots

`santa_rosa_drive_2500m_v1.graphml.gz` is a gzip-compressed copy of the existing Task 1 OSMnx driving graph: 1,662 nodes, 4,358 directed edges, approximately 5 by 5 km around Santa Rosa (38.4404, -122.7141). It supports deterministic offline startup and tests; loading it restores the ignored backend GraphML cache. Compression adds no dependency. Roads and identifiers have not changed.

Source: OpenStreetMap, retrieved through OSMnx/Overpass for this project. **© OpenStreetMap contributors**, made available under the [Open Database License](https://www.openstreetmap.org/copyright). Keep this attribution with redistributed graph data. Speed and travel-time estimates include the documented EvacRoute road-class defaults.

`santa_rosa_public.json` contains normalized FEMA shelter locations and Census tract population/boundaries, with retrieval timestamps and per-field provenance. `kincade_inspection.json` records inspection only, with no runtime calibration values. See [public data documentation](../../backend/app/data/README.md) and the [final API handoff](../../backend/API.md). Large raw downloads remain ignored.
