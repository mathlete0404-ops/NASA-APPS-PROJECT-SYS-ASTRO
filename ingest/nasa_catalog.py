"""Build an offline copy of the NASA dataset catalog entries Crew Mirror cites.

Uses the public data.nasa.gov CKAN API (package_search). The result is stored so the
in-app NASA Evidence Library works with no network (the spacecraft case); the habitat
server also tries a live search first and falls back to this file.

"Dataset metadata from data.nasa.gov"

Output:
  data/nasa_catalog.json
  web/src/generated/nasa_catalog.json

Run:  python3 ingest/nasa_catalog.py
"""

from __future__ import annotations

import json
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://data.nasa.gov/api/3/action/package_search"
# topic -> query. Topics map to app cards (see web/src/content/evidence.ts).
QUERIES = {
    "bone": "astronaut bone loss",
    "muscle": "spaceflight muscle atrophy",
    "spine": "spine spaceflight",
    "balance": "sensorimotor balance spaceflight",
    "sleep": "astronaut sleep",
    "fluid": "fluid shift spaceflight",
    "radiation": "space radiation dosimetry",
    "nutrition": "spaceflight nutrition",
    "inspiration4": "Inspiration4",
    "life-sciences": "Life Sciences Data Archive",
}
ROWS = 15


def _ssl_context():
    """python.org macOS builds ship without CA certs; use certifi when installed."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None


def search(q: str) -> list[dict]:
    url = f"{API}?{urllib.parse.urlencode({'q': q, 'rows': ROWS})}"
    req = urllib.request.Request(url, headers={"User-Agent": "crew-mirror-ingest/0.1"})
    with urllib.request.urlopen(req, timeout=120, context=_ssl_context()) as r:
        return json.load(r)["result"]["results"]


def slim(d: dict, topic: str) -> dict:
    notes = " ".join((d.get("notes") or "").split())
    return {
        "id": d["name"],
        "title": d.get("title", "").strip(),
        "description": notes[:400] + ("…" if len(notes) > 400 else ""),
        "keywords": [t["name"] for t in d.get("tags", [])][:12],
        "organization": (d.get("organization") or {}).get("title"),
        "landing": f"https://data.nasa.gov/dataset/{d['name']}",
        "modified": d.get("metadata_modified", "")[:10],
        "topics": [topic],
    }


def main() -> int:
    seen: dict[str, dict] = {}
    for topic, q in QUERIES.items():
        try:
            results = search(q)
        except Exception as e:  # network failure: keep going, report
            print(f"  ! {topic}: {e}")
            continue
        for d in results:
            if d["name"] in seen:
                if topic not in seen[d["name"]]["topics"]:
                    seen[d["name"]]["topics"].append(topic)
            else:
                seen[d["name"]] = slim(d, topic)
        print(f"  {topic:14s} {len(results)} results")
    out = {"credit": "Dataset metadata from data.nasa.gov", "source": API, "datasets": list(seen.values())}
    for path in (ROOT / "data" / "nasa_catalog.json", ROOT / "web" / "src" / "generated" / "nasa_catalog.json"):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out, indent=1))
    print(f"{len(seen)} datasets saved")
    return 0


if __name__ == "__main__":
    sys.exit(main())
