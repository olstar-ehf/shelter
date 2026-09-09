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

Usage: docgen-config.py [output.yml [data_dir]]  (defaults: stdout, keep
the container data paths /pygeoapi/data)
"""
import sys
from pathlib import Path

CONFIG = Path(__file__).with_name("pygeoapi.config.yml")


def variant(data_dir: str) -> str:
    src = CONFIG.read_text(encoding="utf-8").replace("/pygeoapi/data", data_dir)
    start = src.index("            - type: feature\n              name: PostgreSQL")
    end = src.index("                  search_path: [public]") + len(
        "                  search_path: [public]"
    )
    replacement = (
        "            - type: feature\n"
        "              name: GeoJSON\n"
        f"              data: {data_dir}/windbreak_applications.json\n"
        "              id_field: line_id"
    )
    return src[:start] + replacement + src[end:]


if __name__ == "__main__":
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    data_dir = sys.argv[2] if len(sys.argv) > 2 else "/pygeoapi/data"
    text = variant(data_dir)
    if out_path is None:
        print(text)
    else:
        out_path.write_text(text, encoding="utf-8")
        print(f"wrote {out_path}")
