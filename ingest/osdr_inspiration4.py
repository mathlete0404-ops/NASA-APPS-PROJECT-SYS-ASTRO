"""Download Inspiration4 clinical labs from NASA OSDR and build the
"why a personal baseline?" evidence used by Crew Mirror.

Sources (public, no key needed):
  OSD-569  Complete Blood Count (CBC)           LSDS-7
  OSD-575  Comprehensive Metabolic Panel (CMP)  LSDS-8

Data are courtesy of the NASA Open Science Data Repository (https://osdr.nasa.gov/bio/repo)

Output:
  data/osdr/*.csv                         small copies of the source CSVs
  data/osdr_baseline_evidence.json        per-analyte summary + headline counts
  web/src/generated/osdr_baseline_evidence.json  (same file, bundled into the app)

Method (deterministic, no model):
  For each crew member and analyte, the three pre-flight draws (L-92, L-44, L-3)
  form a personal baseline. The R+1 (day after landing) value is compared with
  (a) the person's own pre-flight range and (b) the lab's population reference
  range. We count changes that leave the personal range while staying inside the
  population range -- changes a population threshold would call "normal".

Run:  python3 ingest/osdr_inspiration4.py
"""

from __future__ import annotations

import csv
import io
import json
import ssl
import statistics
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "osdr"
BASE = "https://osdr.nasa.gov/geode-py/ws/studies"
SOURCES = {
    "cbc": ("OSD-569", "LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv"),
    "cmp": ("OSD-575", "LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv"),
}
PRE = ["L-92", "L-44", "L-3"]
POST = ["R+1", "R+45", "R+82", "R+194"]
# Ratios / derived values add no information and double-count.
SKIP = {"ALBUMIN/GLOBULIN RATIO", "BUN/CREATININE RATIO", "EGFR AFRICAN AMERICAN", "EGFR NON-AFR. AMERICAN"}
CREDIT = "Data are courtesy of the NASA Open Science Data Repository (https://osdr.nasa.gov/bio/repo)"


def _ssl_context():
    """python.org macOS builds ship without CA certs; use certifi when installed."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None


def fetch(study: str, filename: str) -> str:
    local = OUT_DIR / filename
    if local.exists():
        return local.read_text()
    url = f"{BASE}/{study}/download?source=datamanager&file={filename}"
    req = urllib.request.Request(url, headers={"User-Agent": "crew-mirror-ingest/0.1"})
    with urllib.request.urlopen(req, timeout=60, context=_ssl_context()) as r:
        text = r.read().decode("utf-8")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    local.write_text(text)
    return text


def parse(text: str, study: str, panel: str) -> list[dict]:
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        name = r["ANALYTE"].strip().upper().replace(" (FEMALE)", "")
        if name in SKIP:
            continue
        tp = (r.get("TEST_DATE") or r.get("timepoint") or "").strip()
        try:
            value = float(r["VALUE"])
            lo, hi = float(r["RANGE_MIN"]), float(r["RANGE_MAX"])
        except (ValueError, TypeError):
            continue
        rows.append({
            "analyte": name, "value": value, "lo": lo, "hi": hi, "unit": r["UNITS"].strip(),
            "subject": r["SUBJECT_ID"].strip(), "tp": tp, "study": study, "panel": panel,
        })
    return rows


def main() -> int:
    rows: list[dict] = []
    for panel, (study, fn) in SOURCES.items():
        rows += parse(fetch(study, fn), study, panel)

    by = defaultdict(dict)  # (analyte, subject) -> tp -> row
    for r in rows:
        by[(r["analyte"], r["subject"])][r["tp"]] = r

    analytes: dict[str, dict] = {}
    pairs = outside_personal = outside_personal_inside_pop = outside_pop = 0
    for (analyte, subject), tps in sorted(by.items()):
        if not all(t in tps for t in PRE) or "R+1" not in tps:
            continue
        pre = [tps[t]["value"] for t in PRE]
        post = tps["R+1"]
        lo_p, hi_p = min(pre), max(pre)
        med = statistics.median(pre)
        pairs += 1
        out_personal = post["value"] < lo_p or post["value"] > hi_p
        in_pop = post["lo"] <= post["value"] <= post["hi"]
        outside_personal += out_personal
        outside_personal_inside_pop += out_personal and in_pop
        outside_pop += not in_pop

        a = analytes.setdefault(analyte, {
            "analyte": analyte, "unit": post["unit"], "study": post["study"], "panel": post["panel"],
            "subjects": [],
        })
        a["subjects"].append({
            "subject": subject,
            "pre": pre,
            "pre_median": med,
            "series": {t: tps[t]["value"] for t in PRE + POST if t in tps},
            "r1": post["value"],
            "r1_change_pct": round(100 * (post["value"] - med) / med, 1) if med else None,
            "pop_range": [post["lo"], post["hi"]],
            "outside_personal_range": out_personal,
            "inside_population_range": in_pop,
        })

    for a in analytes.values():
        ch = [s["r1_change_pct"] for s in a["subjects"] if s["r1_change_pct"] is not None]
        a["mean_r1_change_pct"] = round(statistics.mean(ch), 1) if ch else None
        a["n_outside_personal_inside_pop"] = sum(
            s["outside_personal_range"] and s["inside_population_range"] for s in a["subjects"])

    out = {
        "credit": CREDIT,
        "studies": [
            {"id": "OSD-569", "title": "Inspiration4 Complete Blood Count (CBC)",
             "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569"},
            {"id": "OSD-575", "title": "Inspiration4 Comprehensive Metabolic Panel (CMP)",
             "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575"},
        ],
        "method": ("Personal range = min..max of the 3 pre-flight draws (L-92, L-44, L-3). "
                   "Compared with the R+1 (day after landing) draw and the lab's population reference range."),
        "headline": {
            "crew": len({s for _, s in by}),
            "pairs": pairs,
            "outside_personal_range": outside_personal,
            "outside_personal_inside_population": outside_personal_inside_pop,
            "outside_population_range": outside_pop,
        },
        "analytes": sorted(analytes.values(), key=lambda a: -a["n_outside_personal_inside_pop"]),
    }
    for path in (ROOT / "data" / "osdr_baseline_evidence.json",
                 ROOT / "web" / "src" / "generated" / "osdr_baseline_evidence.json"):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out, indent=1))
    h = out["headline"]
    print(f"{h['pairs']} crew-analyte pairs; {h['outside_personal_range']} left the personal pre-flight range at R+1; "
          f"{h['outside_personal_inside_population']} of those were still inside the population range; "
          f"{h['outside_population_range']} were outside the population range.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
