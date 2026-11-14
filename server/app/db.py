"""SQLite storage for the habitat server. Stores derived numbers only — never video."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("CREW_MIRROR_DB", Path(__file__).resolve().parents[1] / "habitat.sqlite"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS crew (
  crew_id TEXT PRIMARY KEY,
  role TEXT,
  launch_date TEXT,
  phase TEXT,
  gravity REAL,
  microgravity_days INTEGER DEFAULT 0,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS session (
  session_id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  mission_day INTEGER
);
CREATE TABLE IF NOT EXISTS measurement (
  session_id TEXT NOT NULL,
  crew_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL,
  unit TEXT,
  quality REAL,
  quality_ok INTEGER NOT NULL,
  source TEXT,
  PRIMARY KEY (session_id, metric)
);
CREATE TABLE IF NOT EXISTS symptom_report (
  id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  region TEXT,
  kind TEXT,
  intensity INTEGER,
  payload TEXT,
  triage_level TEXT,
  pattern TEXT,
  reasons TEXT
);
CREATE TABLE IF NOT EXISTS downlink (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crew_id TEXT,
  body TEXT NOT NULL,
  sent_at REAL NOT NULL,
  deliver_at REAL NOT NULL,
  delay_s REAL NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con


def rows(cur: sqlite3.Cursor) -> list[dict]:
    return [dict(r) for r in cur.fetchall()]


def dumps(x) -> str:
    return json.dumps(x, ensure_ascii=False)
