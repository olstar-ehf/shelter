#!/usr/bin/env python3
"""
Print a variant of backend/pygeoapi.config.yml whose windbreak_applications
collection uses the GeoJSON file provider instead of the PostgreSQL one.

`pygeoapi openapi generate` instantiates every provider, and the PostgreSQL
provider needs the database; the OpenAPI document itself only carries
collection metadata, so generating it against the file variant is fine:

    # locally (absolute data dir) or in the container where /pygeoapi/data
    # is mounted:
    python3 docgen-config.py /tmp/local.config.yml
    pygeoapi openapi generate /tmp/local.config.yml --output-file /tmp/local.openapi.yml

(The running server loads providers lazily and can serve the PostgreSQL
provider config without the database until that collection is queried.)

pygeoapi 0.21's GeoJSON provider crashes on an empty FeatureCollection
(`features[0]` IndexError), and the cleaned demo seed may legitimately be
empty - so when writing a config FILE, this script also writes a
placeholder applications GeoJSON next to it (`<output>.windbreak_applications.json`)
and points the provider at it.

Usage: docgen-config.py [output.yml [data_dir]]  (defaults: stdout, keep
the container data paths /pygeoapi/data)
"""
import json
import sys
from pathlib import Path

CONFIG = Path(__file__).with_name("pygeoapi.config.yml")

PLACEHOLDER_FEATURE_COLLECTION = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[-21.8304, 65.45], [-21.8204, 65.45]],
            },
            "properties": {
                "line_id": "docgen-placeholder-1",
                "application_id": "docgen-placeholder",
                "kennitala": "061050-4429",
                "parcel_id": "IS-139555",
                "status": "pending",
                "length_m": 697.0,
                "submitted_at": "2026-01-01T00:00:00Z",
            },
        }
    ],
}


def variant(data_dir: str, apps_data_path: str) -> str:
    src = CONFIG.read_text(encoding="utf-8").replace("/pygeoapi/data", data_dir)
    start = src.index("            - type: feature\n              name: PostgreSQL")
    end = src.index("                  search_path: [public]") + len(
        "                  search_path: [public]"
    )
    replacement = (
        "            - type: feature\n"
        "              name: GeoJSON\n"
        f"              data: {apps_data_path}\n"
        "              id_field: line_id"
    )
    return src[:start] + replacement + src[end:]


if __name__ == "__main__":
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    data_dir = sys.argv[2] if len(sys.argv) > 2 else "/pygeoapi/data"

    if out_path is None:
        # No file output: keep the data-dir path (caller must make sure the
        # file is a non-empty FeatureCollection).
        print(variant(data_dir, f"{data_dir}/windbreak_applications.json"))
    else:
        placeholder = out_path.with_name(
            f"{out_path.name}.windbreak_applications.json"
        )
        placeholder.write_text(
            json.dumps(PLACEHOLDER_FEATURE_COLLECTION, indent=2), encoding="utf-8"
        )
        out_path.write_text(
            variant(data_dir, str(placeholder)), encoding="utf-8"
        )
        print(f"wrote {out_path}")
