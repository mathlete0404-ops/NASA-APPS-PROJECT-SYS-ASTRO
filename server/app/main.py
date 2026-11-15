"""Crew Mirror habitat server — the computer on the spacecraft.

Receives derived numbers (never video) from crew devices, keeps each astronaut's
history, runs the same deterministic status and triage rules as the browser, serves
the offline NASA evidence library and queues delayed messages to Earth.

Run (from server/):  uvicorn app.main:app --reload --port 8000
Prototype, not a medical device.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import db
from .engine import METRICS, freshen, metric_status, per_day, triage

ROOT = Path(__file__).resolve().parents[2]
CATALOG = json.loads((ROOT / "data" / "nasa_catalog.json").read_text()) if (ROOT / "data" / "nasa_catalog.json").exists() else {"datasets": []}
OSDR = json.loads((ROOT / "data" / "osdr_baseline_evidence.json").read_text()) if (ROOT / "data" / "osdr_baseline_evidence.json").exists() else {"analytes": []}
CKAN = "https://data.nasa.gov/api/3/action/package_search"

app = FastAPI(title="Crew Mirror habitat server", version="0.1.0",
              description="Prototype, not a medical device. Derived numbers only; video never leaves the crew device.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ------------------------------------------------------------------ models
class Crew(BaseModel):
    crew_id: str
    role: str = ""
    launch_date: str = ""
    phase: str = "transit"
    gravity: float = 0.0
    microgravity_days: int = 0


class Measurement(BaseModel):
    metric: str
    value: float | None
    unit: str = ""
    quality: float = 1.0
    quality_ok: bool = True
    source: str = ""


class Session(BaseModel):
    session_id: str
    crew_id: str
    ts: str
    mission_day: int | None = None
    measurements: list[Measurement]


class Symptom(BaseModel):
    id: str
    crew_id: str
    ts: str
    region: str
    kind: str = "pain"
    intensity: int = Field(0, ge=0, le=10)
    onset: str = "gradual"
    side: str = ""
    context: list[str] = []
    danger: dict[str, bool] = {}
    tests: dict[str, Any] = {}
    microgravity_days: int = 0


class Downlink(BaseModel):
    crew_id: str = ""
    body: str
    delay_s: float = Field(720, ge=0, le=3600)


# ------------------------------------------------------------------ routes
@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "server": "habitat", "time": time.time()}


@app.put("/api/crew/{crew_id}")
def upsert_crew(crew_id: str, c: Crew) -> dict:
    with db.connect() as con:
        con.execute(
            "INSERT INTO crew VALUES (?,?,?,?,?,?,datetime('now')) ON CONFLICT(crew_id) DO UPDATE SET "
            "role=excluded.role, launch_date=excluded.launch_date, phase=excluded.phase, gravity=excluded.gravity, "
            "microgravity_days=excluded.microgravity_days, updated_at=excluded.updated_at",
            (crew_id, c.role, c.launch_date, c.phase, c.gravity, c.microgravity_days))
    return {"ok": True}


@app.post("/api/sessions")
def add_session(s: Session) -> dict:
    with db.connect() as con:
        con.execute("INSERT OR REPLACE INTO session VALUES (?,?,?,?)", (s.session_id, s.crew_id, s.ts, s.mission_day))
        for m in s.measurements:
            con.execute("INSERT OR REPLACE INTO measurement VALUES (?,?,?,?,?,?,?,?,?)",
                        (s.session_id, s.crew_id, s.ts, m.metric, m.value, m.unit, m.quality, int(m.quality_ok), m.source))
    return {"ok": True, "status": status(s.crew_id)}


def _status(con, crew_id: str, today: str | None = None) -> dict:
    from datetime import date
    today = today or date.today().isoformat()
    # a daily check always records mood, so its day marks the latest check
    row = con.execute("SELECT MAX(substr(ts, 1, 10)) AS d FROM measurement WHERE crew_id=? AND metric='mood'", (crew_id,)).fetchone()
    last_check_day = row["d"] if row else None
    out = {}
    for metric in METRICS:
        hist = con.execute("SELECT ts, value, quality_ok FROM measurement WHERE crew_id=? AND metric=? ORDER BY ts",
                           (crew_id, metric)).fetchall()
        if hist:
            st = metric_status(metric, per_day([(r["ts"], r["value"], bool(r["quality_ok"])) for r in hist]))
            out[metric] = freshen(metric, st, hist[-1]["ts"][:10], last_check_day, today)
    return out


@app.get("/api/status/{crew_id}")
def status(crew_id: str) -> dict:
    with db.connect() as con:
        return {"crew_id": crew_id, "metrics": _status(con, crew_id)}


@app.get("/api/crew")
def crew_overview() -> list[dict]:
    """Crew medical officer view: every crew member, worst status, open alerts."""
    rank = {"act": 4, "watch": 3, "nodata": 2, "usual": 1, "baseline": 0}  # same order as web worst()
    with db.connect() as con:
        crew = db.rows(con.execute("SELECT * FROM crew ORDER BY crew_id"))
        for c in crew:
            st = _status(con, c["crew_id"])
            c["alerts"] = [{"metric": k, "label": METRICS[k]["label"], **v} for k, v in st.items() if v["level"] in ("watch", "act")]
            c["worst"] = max((v["level"] for v in st.values()), key=lambda l: rank[l], default="nodata")
            c["symptoms"] = db.rows(con.execute(
                "SELECT id, ts, region, kind, intensity, triage_level, pattern FROM symptom_report "
                "WHERE crew_id=? ORDER BY ts DESC LIMIT 5", (c["crew_id"],)))
        return crew


@app.post("/api/symptoms")
def add_symptom(s: Symptom) -> dict:
    result = triage(s.model_dump())
    with db.connect() as con:
        con.execute("INSERT OR REPLACE INTO symptom_report VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (s.id, s.crew_id, s.ts, s.region, s.kind, s.intensity, db.dumps(s.model_dump()),
                     result["level"], result["pattern"], db.dumps(result["reasons"])))
    return result


@app.post("/api/triage")
def triage_only(s: Symptom) -> dict:
    """Same rules, nothing stored — for checking a report before saving it."""
    return triage(s.model_dump())


@app.post("/api/downlink")
def send_downlink(d: Downlink) -> dict:
    now = time.time()
    with db.connect() as con:
        cur = con.execute("INSERT INTO downlink (crew_id, body, sent_at, deliver_at, delay_s) VALUES (?,?,?,?,?)",
                          (d.crew_id, d.body, now, now + d.delay_s, d.delay_s))
        return {"id": cur.lastrowid, "deliver_at": now + d.delay_s}


@app.get("/api/downlink")
def list_downlink() -> list[dict]:
    now = time.time()
    with db.connect() as con:
        out = db.rows(con.execute("SELECT * FROM downlink ORDER BY sent_at DESC LIMIT 50"))
    for m in out:
        m["status"] = "delivered" if now >= m["deliver_at"] else "in transit"
        m["remaining_s"] = max(0.0, m["deliver_at"] - now)
    return out


@app.get("/api/nasa/search")
def nasa_search(q: str = "", live: bool = True) -> dict:
    """Live data.nasa.gov CKAN search when Earth link is up; offline catalog otherwise."""
    if live and q:
        try:
            r = httpx.get(CKAN, params={"q": q, "rows": 10}, timeout=4)
            r.raise_for_status()
            res = r.json()["result"]["results"]
            return {"source": "live", "credit": "Dataset metadata from data.nasa.gov", "datasets": [
                {"id": d["name"], "title": d.get("title"), "description": (d.get("notes") or "")[:400],
                 "landing": f"https://data.nasa.gov/dataset/{d['name']}", "modified": (d.get("metadata_modified") or "")[:10]}
                for d in res]}
        except Exception:
            pass
    terms = [t for t in q.lower().split() if t]
    hits = [d for d in CATALOG["datasets"]
            if all(t in (d["title"] + " " + d["description"] + " " + " ".join(d.get("keywords", []))).lower() for t in terms)]
    return {"source": "offline", "credit": "Dataset metadata from data.nasa.gov", "datasets": hits[:25]}


@app.get("/api/reference/{analyte}")
def reference(analyte: str) -> dict:
    for a in OSDR["analytes"]:
        if a["analyte"].lower() == analyte.lower():
            return {**a, "credit": OSDR.get("credit")}
    raise HTTPException(404, "analyte not found")
