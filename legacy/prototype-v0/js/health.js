// Health analysis: general ranges + personal-baseline anomaly detection + trend rules.
// Ranges are general adult guidance only - not medical advice.
const Health = (() => {
  // level order
  const RANK = { none: 0, ok: 1, watch: 2, alert: 3 };
  const worst = (a, b) => (RANK[b] > RANK[a] ? b : a);

  // watch/alert: [low, high] - value outside triggers that level
  const METRICS = [
    { key: "hr", label: "Heart rate", unit: "bpm", src: "checkins", watch: [50, 100], alert: [40, 120], hazard: "Gravity fields",
      why: "Resting heart rate. Fluid shifts in microgravity change heart workload." },
    { key: "sys", label: "Systolic BP", unit: "mmHg", src: "checkins", watch: [90, 130], alert: [80, 160], hazard: "Gravity fields",
      why: "Upper blood pressure number." },
    { key: "dia", label: "Diastolic BP", unit: "mmHg", src: "checkins", watch: [55, 85], alert: [45, 100], hazard: "Gravity fields",
      why: "Lower blood pressure number." },
    { key: "spo2", noHigh: true, label: "SpO2", unit: "%", src: "checkins", watch: [95, 101], alert: [92, 101], hazard: "Hostile environment",
      why: "Blood oxygen. Drops can mean breathing or cabin air problems." },
    { key: "temp", label: "Temperature", unit: "C", src: "checkins", watch: [35.8, 37.6], alert: [35.0, 38.3], hazard: "Hostile environment",
      why: "Core temperature runs higher in long-duration spaceflight, so the personal baseline matters." },
    { key: "rr", label: "Breathing rate", unit: "/min", src: "checkins", watch: [10, 22], alert: [8, 28], hazard: "Hostile environment",
      why: "Breaths per minute at rest." },
    { key: "sleep", noHigh: true, label: "Sleep", unit: "h", src: "checkins", watch: [6, 24], alert: [4, 24], hazard: "Isolation & confinement",
      why: "Under 6 h was linked to slower reactions and higher stress in NASA's ISS Reaction Self Test study." },
    { key: "mood", noHigh: true, label: "Mood", unit: "/5", src: "checkins", watch: [3, 6], alert: [2, 6], hazard: "Isolation & confinement",
      why: "Self-rated mood (1 low - 5 high)." },
    { key: "stress", label: "Stress", unit: "/10", src: "checkins", watch: [0, 6], alert: [0, 8], hazard: "Isolation & confinement",
      why: "Self-rated stress." },
    { key: "fatigue", label: "Fatigue", unit: "/10", src: "checkins", watch: [0, 6], alert: [0, 8], hazard: "Isolation & confinement",
      why: "Self-rated tiredness." },
    { key: "meanRT", label: "Reaction time", unit: "ms", src: "pvt", watch: [0, 400], alert: [0, 500], hazard: "Isolation & confinement",
      why: "Mean response time on the alertness test. Slower = more fatigued." },
    { key: "lapses", label: "Attention lapses", unit: "", src: "pvt", watch: [0, 4], alert: [0, 9], hazard: "Isolation & confinement",
      why: "Responses of 355 ms or slower on the alertness test." },
  ];

  const byKey = Object.fromEntries(METRICS.map((m) => [m.key, m]));
  const fmt = (v, m) => (v == null || v === "" || isNaN(v) ? "--" : (Math.round(v * 10) / 10) + (m?.unit ? " " + m.unit : ""));

  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const sd = (a) => {
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1));
  };

  // Minimum spread so tiny natural variation doesn't create false alarms
  const MIN_SD = { hr: 2, sys: 3, dia: 2, spo2: 0.8, temp: 0.15, rr: 1, sleep: 0.4, mood: 0.5, stress: 0.8, fatigue: 0.8, meanRT: 12, lapses: 1 };

  function values(key, crewId) {
    const m = byKey[key];
    return Store.list(m.src, crewId)
      .filter((r) => r[key] !== undefined && r[key] !== null && r[key] !== "" && !isNaN(r[key]))
      .map((r) => ({ t: new Date(r.time), v: Number(r[key]), rec: r }));
  }

  function baseline(key, crewId, excludeLast = true) {
    let vals = values(key, crewId).map((p) => p.v);
    if (excludeLast) vals = vals.slice(0, -1);
    vals = vals.slice(-30); // rolling 30-reading baseline
    if (vals.length < 5) return null;
    return { mean: mean(vals), sd: Math.max(sd(vals), MIN_SD[key] || 0), n: vals.length };
  }

  // Evaluate one value: general range + personal baseline
  function evaluate(key, value, crewId, base = baseline(key, crewId)) {
    const m = byKey[key];
    if (value == null || value === "" || isNaN(value)) return { level: "none", reasons: [] };
    const v = Number(value);
    let level = "ok";
    const reasons = [];

    if (v < m.alert[0] || v > m.alert[1]) {
      level = "alert";
      reasons.push(v < m.alert[0] ? "well below typical range" : "well above typical range");
    } else if (v < m.watch[0] || v > m.watch[1]) {
      level = "watch";
      reasons.push(v < m.watch[0] ? "below typical range" : "above typical range");
    }

    let z = null;
    if (base) {
      z = (v - base.mean) / base.sd;
      const az = Math.abs(z);
      if (az >= 2) {
        // A baseline deviation alone is "Watch"; it becomes "Alert" only if it is large (3+ SD)
        // AND the value is also outside the general watch range.
        const outside = v < m.watch[0] || v > m.watch[1];
        level = worst(level, az >= 3 && outside ? "alert" : "watch");
        reasons.push(`${az.toFixed(1)} SD ${z > 0 ? "above" : "below"} personal baseline`);
      }
    }
    return { level, reasons, z, base };
  }

  function latest(key, crewId) {
    const v = values(key, crewId);
    return v.length ? v[v.length - 1] : null;
  }

  function slope(points) {
    // least squares slope per day
    if (points.length < 3) return 0;
    const xs = points.map((p) => p.t.getTime() / 86400000);
    const ys = points.map((p) => p.v);
    const mx = mean(xs), my = mean(ys);
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    return den ? num / den : 0;
  }

  const ACTIONS = {
    hr: { watch: "Rest 10 minutes and recheck. Note activity, caffeine and stress.", alert: "Rest and recheck now. If it persists or you feel unwell, contact the Crew Medical Officer." },
    sys: { watch: "Recheck seated after 5 minutes of rest.", alert: "Recheck now. If confirmed, report to the Crew Medical Officer / flight surgeon." },
    dia: { watch: "Recheck seated after 5 minutes of rest.", alert: "Recheck now. If confirmed, report to the Crew Medical Officer / flight surgeon." },
    spo2: { watch: "Recheck with sensor warm and still. Check cabin air (CO2) readings.", alert: "Recheck immediately, check cabin atmosphere, and contact the Crew Medical Officer." },
    temp: { watch: "Recheck in 1 hour. Hydrate and note any illness symptoms.", alert: "Possible fever. Rest, hydrate, log symptoms and inform the Crew Medical Officer." },
    rr: { watch: "Recheck at rest.", alert: "Recheck at rest and report if breathing feels difficult." },
    sleep: { watch: "Protect your next sleep period: dim lights, limit screens and caffeine late in the day.", alert: "Severe sleep loss. Avoid critical tasks if possible and discuss schedule with the crew." },
    mood: { watch: "Take a break, connect with crew or family, do something you enjoy.", alert: "Talk with a crewmate or schedule a private conference with the behavioral health team." },
    stress: { watch: "Try a short breathing exercise and review workload priorities.", alert: "Raise workload with the commander / ground and use behavioral health support." },
    fatigue: { watch: "Plan a rest break and avoid stacking demanding tasks.", alert: "High fatigue: avoid safety-critical tasks until rested if possible." },
    meanRT: { watch: "Alertness is reduced. Take extra care on complex tasks.", alert: "Alertness strongly reduced. Postpone safety-critical tasks or use a buddy check." },
    lapses: { watch: "Several attention lapses. Consider a short rest.", alert: "Many attention lapses. Rest before safety-critical work." },
  };

  // Main analysis for a crew member -> list of insights
  function insights(crewId) {
    const out = [];
    const now = Date.now();
    const DAY = 86400000;

    // 1) Latest value for each metric (only if recent: last 3 days)
    METRICS.forEach((m) => {
      const l = latest(m.key, crewId);
      if (!l || now - l.t.getTime() > 3 * DAY) return;
      const e = evaluate(m.key, l.v, crewId);
      if (e.level === "watch" || e.level === "alert") {
        out.push({
          level: e.level, hazard: m.hazard,
          title: `${m.label}: ${fmt(l.v, m)}`,
          detail: e.reasons.join(", ") + (e.base ? ` (baseline ${fmt(e.base.mean, m)})` : ""),
          action: ACTIONS[m.key]?.[e.level] || "",
        });
      }
    });

    // 2) Trend: sleep debt over last 3 check-ins
    const sleep = values("sleep", crewId).filter((p) => now - p.t.getTime() < 4 * DAY);
    if (sleep.length >= 3) {
      const last3 = sleep.slice(-3);
      const avg = mean(last3.map((p) => p.v));
      if (avg < 6) out.push({
        level: avg < 5 ? "alert" : "watch", hazard: "Isolation & confinement",
        title: `Sleep debt: ${avg.toFixed(1)} h average over 3 days`,
        detail: "Repeated short sleep builds up fatigue even if each night seems manageable.",
        action: ACTIONS.sleep[avg < 5 ? "alert" : "watch"],
      });
    }

    // 3) Trend: rising reaction time / stress
    const rt = values("meanRT", crewId).slice(-4);
    if (rt.length >= 3) {
      const s = slope(rt);
      if (s > 8 && rt[rt.length - 1].v > rt[0].v + 25) out.push({
        level: "watch", hazard: "Isolation & confinement",
        title: "Alertness declining",
        detail: `Reaction time rose from ${Math.round(rt[0].v)} to ${Math.round(rt[rt.length - 1].v)} ms over the last ${rt.length} tests.`,
        action: "Look at sleep and workload together. Retest after rest.",
      });
    }
    const st = values("stress", crewId).slice(-5);
    if (st.length >= 4 && slope(st) > 0.5 && st[st.length - 1].v >= 6) out.push({
      level: "watch", hazard: "Isolation & confinement",
      title: "Stress trending up",
      detail: `Stress went from ${st[0].v} to ${st[st.length - 1].v}/10 over the last ${st.length} check-ins.`,
      action: ACTIONS.stress.watch,
    });

    // 4) Symptoms in last 48h
    const sym = Store.list("symptoms", crewId).filter((s) => now - new Date(s.time).getTime() < 2 * DAY);
    sym.forEach((s) => {
      if (s.severity >= 4) out.push({
        level: s.severity >= 7 ? "alert" : "watch", hazard: symptomHazard(s.symptom),
        title: `Symptom: ${s.symptom} (${s.severity}/10)`,
        detail: `${s.area}, ${s.duration}. Logged ${timeAgo(s.time)}.`,
        action: s.severity >= 7 ? "Report to the Crew Medical Officer and follow the onboard medical checklist." : "Monitor and log again if it changes.",
      });
    });
    // repeated same symptom
    const counts = {};
    Store.list("symptoms", crewId).filter((s) => now - new Date(s.time).getTime() < 7 * DAY)
      .forEach((s) => (counts[s.symptom] = (counts[s.symptom] || 0) + 1));
    Object.entries(counts).forEach(([name, c]) => {
      if (c >= 3) out.push({
        level: "watch", hazard: symptomHazard(name),
        title: `Recurring symptom: ${name}`,
        detail: `Logged ${c} times in the last 7 days.`,
        action: "Recurring symptoms are worth reviewing with the Crew Medical Officer.",
      });
    });

    // 5) Combination: fever-like temp + symptoms
    const t = latest("temp", crewId);
    if (t && now - t.t.getTime() < DAY && evaluate("temp", t.v, crewId).level !== "ok" &&
        sym.some((s) => /fever|cough|throat|headache|fatigue/i.test(s.symptom))) {
      out.push({
        level: "alert", hazard: "Hostile environment",
        title: "Possible infection pattern",
        detail: "Raised temperature together with illness symptoms in the last 48 h.",
        action: "Limit close contact, wipe shared surfaces, hydrate, and inform the Crew Medical Officer.",
      });
    }

    // 6) Exercise vs target (only flag after midday)
    const target = Number(Store.data.mission.exTarget) || 0;
    const exToday = exerciseMinutesOn(crewId, new Date());
    if (target && new Date().getHours() >= 18 && exToday < target * 0.5) out.push({
      level: "watch", hazard: "Gravity fields",
      title: `Exercise low today: ${exToday}/${target} min`,
      detail: "Daily exercise is the main protection against bone and muscle loss in reduced gravity.",
      action: "Schedule a resistance or treadmill session before sleep period if possible.",
    });

    // 7) Space weather
    const sw = SpaceWeather.status();
    if (sw && sw.level !== "ok") out.push({
      level: sw.level, hazard: "Space radiation",
      title: sw.title, detail: sw.text, action: sw.action,
    });

    // 8) Missing data
    const lastCheck = Store.list("checkins", crewId).slice(-1)[0];
    if (!lastCheck || now - new Date(lastCheck.time).getTime() > 1.5 * DAY) out.push({
      level: "none", hazard: "Distance from Earth",
      title: "Check-in due",
      detail: lastCheck ? `Last check-in ${timeAgo(lastCheck.time)}.` : "No check-ins yet.",
      action: "Complete the Daily Check-in so problems can be caught early.",
    });

    out.sort((a, b) => RANK[b.level] - RANK[a.level]);
    return out;
  }

  function overall(crewId) {
    const list = insights(crewId);
    let lvl = "ok";
    list.forEach((i) => (lvl = worst(lvl, i.level)));
    const hasData = Store.list("checkins", crewId).length > 0;
    return { level: hasData ? lvl : "none", list };
  }

  function symptomHazard(name) {
    if (/stress|mood|sleep|concentrat/i.test(name)) return "Isolation & confinement";
    if (/back|muscle|joint|dizz|vision|congestion/i.test(name)) return "Gravity fields";
    return "Hostile environment";
  }

  function exerciseMinutesOn(crewId, date) {
    const d = date.toDateString();
    return Math.round(Store.list("exercise", crewId)
      .filter((e) => new Date(e.time).toDateString() === d)
      .reduce((s, e) => s + (Number(e.minutes) || 0), 0));
  }

  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }

  return { METRICS, byKey, RANK, worst, fmt, values, baseline, evaluate, latest, insights, overall, exerciseMinutesOn, timeAgo, mean, sd };
})();
