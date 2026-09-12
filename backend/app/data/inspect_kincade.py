"""Bounded workbook inspection only; no speculative runtime calibration."""

import json
import argparse
import hashlib
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
import requests

from app.data.ingest import save_json
from app.data.public_data import PROCESSED_PATH

WORKBOOK = PROCESSED_PATH.parents[1] / "raw/kincade/data_routine_evacuation.xlsx"
SOURCE = "https://zenodo.org/records/7410114"
DOWNLOAD_URL = "https://zenodo.org/api/records/7410114/files/data_routine_evacuation.xlsx/content"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def inspect_workbook(path=WORKBOOK):
    # Read OOXML directly for source inspection: no workbook editing/export.
    with zipfile.ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            strings = ["".join(n.itertext()) for n in root.findall("m:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {r.attrib["Id"]: r.attrib["Target"] for r in relationships}
        sheets = []
        for sheet in workbook.findall("m:sheets/m:sheet", NS):
            id_ = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = targets[id_]
            filename = target.lstrip("/") if target.startswith("/") else "xl/" + target
            rows = []
            dimension = None
            with archive.open(filename) as stream:
                for _, element in ET.iterparse(stream, events=("end",)):
                    if element.tag.endswith("}dimension"):
                        dimension = element.attrib.get("ref")
                    if element.tag.endswith("}row"):
                        cells = []
                        for cell in element.findall("m:c", NS)[:16]:
                            value = cell.findtext("m:v", default="", namespaces=NS)
                            if cell.attrib.get("t") == "s":
                                value = strings[int(value)]
                            elif cell.attrib.get("t") == "inlineStr":
                                value = "".join(cell.find("m:is", NS).itertext())
                            cells.append(value)
                        rows.append(cells)
                        if len(rows) == 3:
                            break
            sheets.append({"name": sheet.attrib["name"], "dimension": dimension, "first_rows": rows})
    return {"source": SOURCE, "downloaded_file": path.name, "size_bytes": path.stat().st_size,
            "sheets": sheets, "runtime_integrated": False, "derived_values": {},
            "decision": "Inspection only: station/time-series data requires matched routine periods, units and geographic sensor-to-road mapping; no defensible graph-wide multiplier derived in this task."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Download the published 12.9 MB workbook if absent")
    args = parser.parse_args()
    if args.download and not WORKBOOK.exists():
        WORKBOOK.parent.mkdir(parents=True, exist_ok=True)
        with requests.get(DOWNLOAD_URL, stream=True, timeout=30) as response:
            response.raise_for_status()
            temporary = WORKBOOK.with_suffix(".tmp")
            digest = hashlib.md5()
            with temporary.open("wb") as output:
                for chunk in response.iter_content(1024 * 1024):
                    output.write(chunk)
                    digest.update(chunk)
            if digest.hexdigest() != "5c3d5a1adbdae347c81e75a8d4a51851":
                raise ValueError("Kincade workbook checksum differs from the published record")
            temporary.replace(WORKBOOK)
    result = inspect_workbook()
    save_json(PROCESSED_PATH.with_name("kincade_inspection.json"), result)
    print(json.dumps(result, indent=2)[:6000])
