"""Shared-case tests: the same JSON cases run against the TypeScript engine (vitest)."""

import json
from pathlib import Path

import pytest

from app.engine import metric_status, per_day, triage

SHARED = Path(__file__).resolve().parents[2] / "shared"
TRIAGE = json.loads((SHARED / "triage_cases.json").read_text())
STATUS = json.loads((SHARED / "status_cases.json").read_text())


@pytest.mark.parametrize("case", TRIAGE, ids=[c["name"] for c in TRIAGE])
def test_triage(case):
    got = triage(case["input"])
    for k, v in case["expect"].items():
        assert got[k] == v, (k, got)
    assert got["reasons"], "every result must show its reasons"


@pytest.mark.parametrize("case", STATUS, ids=[c["name"] for c in STATUS])
def test_status(case):
    got = metric_status(case["metric"], [tuple(h) for h in case["history"]])
    assert got["level"] == case["expect"]["level"], got
    assert got["reasons"]


def test_api_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("CREW_MIRROR_DB", str(tmp_path / "t.sqlite"))
    import importlib

    from app import db
    importlib.reload(db)
    from app import main
    importlib.reload(main)
    from fastapi.testclient import TestClient

    c = TestClient(main.app)
    assert c.get("/api/health").json()["ok"]
    c.put("/api/crew/CDR", json={"crew_id": "CDR", "role": "Commander"})
    for i in range(8):
        r = c.post("/api/sessions", json={"session_id": f"s{i}", "crew_id": "CDR", "ts": f"2026-11-{i + 1:02d}T08:00:00",
                                          "measurements": [{"metric": "hr_rest", "value": 60 + (i % 3), "quality_ok": True}]})
        assert r.status_code == 200
    st = c.get("/api/status/CDR").json()["metrics"]["hr_rest"]
    assert st["level"] == "usual"
    r = c.post("/api/symptoms", json={"id": "x", "crew_id": "CDR", "ts": "2026-11-09", "region": "lower_back",
                                      "danger": {"chest_pain": True}})
    assert r.json()["level"] == "act_now"
    assert c.get("/api/crew").json()[0]["symptoms"][0]["triage_level"] == "act_now"


def test_per_day_keeps_one_value_per_day():
    rows = [("2026-11-01T08:00", 60, True), ("2026-11-01T09:00", 99, False), ("2026-11-01T10:00", 61, True),
            ("2026-11-02T08:00", 70, False)]
    assert per_day(rows) == [(61, True), (70, False)]
