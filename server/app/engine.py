"""Deterministic rules: personal-baseline status engine and symptom triage.

This is a line-for-line port of web/src/engine/{status,triage}.ts. Both are tested
against the same cases in shared/*.json so they cannot drift apart.

Rules, not AI: every result carries the reasons that produced it.
Prototype, not a medical device.
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path
from typing import Any

SHARED = Path(__file__).resolve().parents[2] / "shared"
METRICS = {m["id"]: m for m in json.loads((SHARED / "metrics.json").read_text())["metrics"]}

BASELINE_N = 7
WATCH_Z = 2.0
ACT_Z = 3.0
WATCH_STREAK = 3
MAD_TO_SD = 1.4826

# ------------------------------------------------------------------ status


def _fmt(x: float) -> str:
    a = abs(x)
    return f"{round(x, 0 if a >= 100 else 1 if a >= 10 else 2):g}"


def metric_status(metric: str, history: list[tuple[float | None, bool]]) -> dict[str, Any]:
    """history: chronological (value, quality_ok). Status describes the latest entry."""
    floor = METRICS.get(metric, {}).get("floor", 1e-6)
    if not history:
        return {"level": "nodata", "reasons": ["No measurement yet."]}
    value, ok = history[-1]
    if value is None or not ok:
        return {"level": "nodata", "reasons": ["Latest measurement failed the quality check, so it is shown as No data, not Fine."]}

    good = [(i, v) for i, (v, q) in enumerate(history) if q and v is not None]
    base = [v for _, v in good[:BASELINE_N]]
    if len(base) < BASELINE_N or good[BASELINE_N - 1][0] >= len(history) - 1:
        n = min(len(base), BASELINE_N)
        return {"level": "baseline", "n": n, "reasons": [f"Building your personal baseline ({n}/{BASELINE_N} good sessions)."]}

    med = statistics.median(base)
    mad = statistics.median([abs(v - med) for v in base])
    scale = max(MAD_TO_SD * mad, floor)

    def z_of(v: float) -> float:
        return (v - med) / scale

    z = z_of(value)
    after = [v for i, v in good if i > good[BASELINE_N - 1][0]]
    reasons = [f"Baseline median {_fmt(med)}, robust spread {scale:.3g} (1.4826 × MAD, floor {floor:g}); today z = {z:+.1f}."]
    if abs(z) > ACT_Z:
        level = "act"
        reasons.append(f"|z| > {ACT_Z:g}: far from your own usual.")
    elif abs(z) > WATCH_Z:
        level = "watch"
        reasons.append(f"|z| > {WATCH_Z:g}: outside your usual range.")
        tail = after[-WATCH_STREAK:]
        if len(tail) == WATCH_STREAK and all(abs(z_of(v)) > WATCH_Z for v in tail):
            level = "act"
            reasons.append(f"Watch {WATCH_STREAK} sessions in a row → Act.")
    else:
        level = "usual"
    return {"level": level, "z": round(z, 2), "median": med, "scale": scale, "value": value, "reasons": reasons}


def per_day(rows: list[tuple[str, float | None, bool]]) -> list[tuple[float | None, bool]]:
    """rows: chronological (iso_ts, value, ok). Keep one value per calendar day: the day's last
    good measurement, else its last attempt. Baseline = 7 days; Watch streak = days."""
    by_day: dict[str, tuple[float | None, bool]] = {}
    for ts, v, ok in rows:
        k = ts[:10]
        prev = by_day.get(k)
        if prev is None or ok or not prev[1]:
            by_day[k] = (v, ok)
    return list(by_day.values())


# ------------------------------------------------------------------ triage

DANGER_LABELS = {
    "chest_pain": "Chest pain",
    "one_sided_weakness": "Sudden one-sided weakness or numbness, face drooping, or slurred speech",
    "severe_headache_vision": "Sudden severe headache or vision change",
    "back_pain_leg_numb_bladder": "Back pain with leg numbness or bladder/bowel change",
    "fall_impact": "Pain after a fall or impact",
}
WEIGHT_BEARING = {"lower_back", "hip", "thigh", "knee", "lower_leg", "ankle_foot"}
BONE_LOSS_PER_MONTH = 1.0  # % per month at weight-bearing sites without full countermeasures
BASE_REFER_INTENSITY = 8
MIN_REFER_INTENSITY = 5


def bone_loss_estimate(microgravity_days: int) -> float:
    return round(min(max(microgravity_days, 0) / 30.0 * BONE_LOSS_PER_MONTH, 15.0), 1)


def refer_intensity(region: str, microgravity_days: int) -> int:
    if region not in WEIGHT_BEARING:
        return BASE_REFER_INTENSITY
    return max(MIN_REFER_INTENSITY, BASE_REFER_INTENSITY - int(bone_loss_estimate(microgravity_days) // 2))


def triage(inp: dict[str, Any]) -> dict[str, Any]:
    danger = inp.get("danger") or {}
    tests = inp.get("tests") or {}
    region = inp.get("region", "other")
    kind = inp.get("kind", "pain")
    intensity = int(inp.get("intensity", 0))
    days = int(inp.get("microgravity_days", 0))
    bone = bone_loss_estimate(days)

    def out(level: str, pattern: str, reasons: list[str], exercises: bool) -> dict[str, Any]:
        return {"level": level, "pattern": pattern, "reasons": reasons, "exercises_allowed": exercises,
                "bone_loss_est_pct": bone}

    yes = [DANGER_LABELS[k] for k in DANGER_LABELS if danger.get(k)]
    if yes:
        return out("act_now", "danger_sign", [f"Danger sign: {y}." for y in yes], False)

    if region == "trunk_front":
        return out("cmo", "trunk_front", ["Chest or abdominal pain is not assessed by self-tests in this app: the crew medical officer checks it."], False)

    if kind == "numbness" or tests.get("spreading_tingling"):
        return out("cmo", "nerve", ["Numbness or spreading tingling suggests a nerve pattern."], False)

    if kind == "weakness":
        return out("cmo", "weakness", ["New weakness needs a check by the crew medical officer."], False)

    flags = []
    if tests.get("bony_tender"):
        flags.append("Sharp pain on one bony spot")
    if tests.get("cannot_bear_weight"):
        flags.append("Cannot bear weight")
    if tests.get("swelling"):
        flags.append("Swelling")
    if flags:
        reasons = [f"{f}." for f in flags] + ["Possible-fracture pattern: STOP, no exercises."]
        if region in WEIGHT_BEARING and bone >= 3:
            reasons.append(f"Estimated weight-bearing bone loss ≈ {bone:g}% after {days} days in microgravity.")
        return out("cmo", "possible_fracture", reasons, False)

    limit = refer_intensity(region, days)
    if intensity >= limit:
        reasons = [f"Pain {intensity}/10 is at or above the referral level {limit}/10."]
        if limit < BASE_REFER_INTENSITY:
            reasons.append(f"Referral level lowered from {BASE_REFER_INTENSITY} to {limit} because estimated "
                           f"weight-bearing bone loss is ≈ {bone:g}% ({days} days × ~1%/month).")
        return out("cmo", "severe_pain", reasons, False)

    if region == "head":
        return out("self_care", "headache_fluid_shift",
                   ["Gradual headache with no danger signs: check cabin CO₂, fluids and sleep first."], False)

    found = []
    if tests.get("muscle_tender"):
        found.append(("muscle_strain", "Pressing the muscle belly hurts → muscle strain / inflammation pattern."))
    if tests.get("resisted_pain"):
        found.append(("tendon_irritation", "Pain when tightening against resistance → muscle/tendon irritation pattern."))
    if tests.get("stretch_pain"):
        found.append(("tightness", "Pain on stretch → tightness / strain pattern."))
    if tests.get("rom_pain_angle") is not None:
        found.append(("joint_irritation", f"Pain starts at {tests['rom_pain_angle']}° in the range test → joint irritation pattern."))
    if not found:
        return out("self_care", "nonspecific",
                   ["No test reproduced the pain → non-specific / deconditioning pattern."], True)
    return out("self_care", found[0][0], [r for _, r in found], True)
