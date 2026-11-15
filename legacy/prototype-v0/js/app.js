// UI wiring for all pages
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtTime = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const LEVEL_TEXT = { ok: "Nominal", watch: "Watch", alert: "Alert", none: "No data" };
  const flash = (el, msg, ok = true) => {
    el.textContent = msg;
    el.style.color = ok ? "" : "var(--alert)";
    setTimeout(() => (el.textContent = ""), 2500);
  };
  const D = () => Store.data;
  const crew = () => D().currentCrew;

  // ================= Navigation =================
  let page = "dashboard";
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.addEventListener("click", () => go(b.dataset.page))
  );

  function go(p) {
    page = p;
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === p));
    document.querySelectorAll(".page").forEach((s) => s.classList.toggle("active", s.id === "page-" + p));
    // move the shared camera view
    if (p === "exercise") $("exStageSlot").appendChild($("stage"));
    if (p === "scan") $("scanStageSlot").appendChild($("stage"));
    render();
  }

  function render() {
    renderSidebar();
    if (page === "dashboard") renderDashboard();
    if (page === "symptoms") renderSymptoms();
    if (page === "pvt") renderPvtList();
    if (page === "exercise") renderExercise();
    if (page === "trends") renderTrends();
    if (page === "radiation") renderWeather();
    if (page === "settings") renderSettings();
  }

  // ================= Sidebar =================
  $("crewSelect").addEventListener("change", (e) => {
    D().currentCrew = e.target.value;
    Store.save();
    render();
  });

  function renderSidebar() {
    $("crewSelect").innerHTML = D().crew.map((c) =>
      `<option value="${c.id}" ${c.id === crew() ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    $("missionName").textContent = D().mission.name;
    $("missionDay").textContent = "Day " + Store.missionDay();
  }

  // ================= Dashboard =================
  const TILE_KEYS = ["hr", "sys", "spo2", "temp", "rr", "sleep", "stress", "fatigue", "mood", "meanRT"];

  function renderDashboard() {
    const ov = Health.overall(crew());
    const banner = $("statusBanner");
    banner.className = "status-banner " + ov.level;
    $("overallStatus").textContent = LEVEL_TEXT[ov.level];
    const nAlert = ov.list.filter((i) => i.level === "alert").length;
    const nWatch = ov.list.filter((i) => i.level === "watch").length;
    $("overallText").textContent = ov.level === "none"
      ? "No check-ins yet. Start with a Daily Check-in, or load demo data in Settings."
      : nAlert || nWatch
        ? `${nAlert} alert(s), ${nWatch} item(s) to watch for ${Store.crewName(crew())}.`
        : `All recent readings for ${Store.crewName(crew())} are within normal and personal ranges.`;
    $("dashUpdated").textContent = "Updated " + new Date().toLocaleTimeString();

    // tiles
    $("metricTiles").innerHTML = TILE_KEYS.map((k) => {
      const m = Health.byKey[k];
      const l = Health.latest(k, crew());
      const e = l ? Health.evaluate(k, l.v, crew()) : { level: "none" };
      const base = Health.baseline(k, crew());
      const note = !l ? "no data" : base ? `baseline ${Health.fmt(base.mean)} · ${Health.timeAgo(l.rec.time)}` : Health.timeAgo(l.rec.time);
      return `<div class="tile ${e.level}" data-metric="${k}" title="${esc(m.why)}">
        <span class="name">${m.label}</span>
        <span class="val">${l ? Math.round(l.v * 10) / 10 : "--"}<small>${m.unit}</small></span>
        <canvas data-spark="${k}"></canvas>
        <span class="note">${note}</span>
      </div>`;
    }).join("");
    document.querySelectorAll("[data-spark]").forEach((c) => {
      const vals = Health.values(c.dataset.spark, crew()).slice(-14).map((p) => p.v);
      Chart.spark(c, vals);
    });
    document.querySelectorAll(".tile").forEach((t) => t.addEventListener("click", () => {
      go("trends");
      $("trendMetric").value = t.dataset.metric;
      renderTrends();
    }));

    // insights
    $("insightList").innerHTML = ov.list.length
      ? ov.list.map((i) => `<li class="${i.level}">
          <div class="h">${esc(i.hazard)}</div>
          <div class="t">${esc(i.title)}</div>
          <div class="d">${esc(i.detail)}</div>
          ${i.action ? `<div class="a">Action: ${esc(i.action)}</div>` : ""}
        </li>`).join("")
      : `<li class="ok"><div class="t">No issues detected</div><div class="d">Keep logging daily so changes can be spotted early.</div></li>`;

    // today
    const today = new Date().toDateString();
    const isToday = (r) => new Date(r.time).toDateString() === today;
    const ci = Store.list("checkins", crew()).filter(isToday);
    const pv = Store.list("pvt", crew()).filter(isToday);
    const sy = Store.list("symptoms", crew()).filter((s) => Date.now() - new Date(s.time).getTime() < 86400000);
    $("todayCheckin").innerHTML = ci.length ? `<span class="pill ok">Done</span>` : `<span class="pill watch">Due</span>`;
    $("todayPvt").innerHTML = pv.length ? `<span class="pill ok">${pv[pv.length - 1].meanRT} ms</span>` : `<span class="pill none">Not taken</span>`;
    $("todaySymptoms").textContent = sy.length;
    const exMin = Health.exerciseMinutesOn(crew(), new Date());
    const target = Number(D().mission.exTarget) || 0;
    $("todayExMin").textContent = exMin;
    $("todayExTarget").textContent = target;
    $("todayExBar").style.width = Math.min(100, target ? (exMin / target) * 100 : 0) + "%";

    // weather
    const sw = SpaceWeather.status();
    $("dashWeather").innerHTML = sw
      ? `<span class="pill ${sw.level}">${sw.level === "ok" ? "Quiet" : LEVEL_TEXT[sw.level]}</span> ${esc(sw.title)}`
      : esc(SpaceWeather.state?.error || "Loading NASA DONKI data...");

    // crew table
    $("crewTable").innerHTML = D().crew.map((c) => {
      const o = Health.overall(c.id);
      const last = Store.list("checkins", c.id).slice(-1)[0];
      const n = o.list.filter((i) => i.level === "alert" || i.level === "watch").length;
      return `<tr>
        <td>${esc(c.name)}</td><td>${esc(c.role || "")}</td>
        <td><span class="pill ${o.level}">${LEVEL_TEXT[o.level]}</span></td>
        <td>${last ? Health.timeAgo(last.time) : "--"}</td>
        <td>${n}</td>
        <td>${Health.exerciseMinutesOn(c.id, new Date())} min</td>
      </tr>`;
    }).join("");
  }

  // ================= Range outputs =================
  document.querySelectorAll('input[type="range"]').forEach((r) => {
    const out = document.querySelector(`[data-out="${r.name}"]`);
    if (out) r.addEventListener("input", () => (out.textContent = r.value));
  });
  const resetRanges = (form) => form.querySelectorAll('input[type="range"]').forEach((r) => {
    const out = document.querySelector(`[data-out="${r.name}"]`);
    if (out) out.textContent = r.value;
  });

  // ================= Check-in =================
  $("useScanBtn").addEventListener("click", () => {
    const s = Store.list("scans", crew()).slice(-1)[0];
    const f = $("checkinForm");
    const live = Camera.running ? Camera.live : null;
    const hr = live?.hr ?? (s && Date.now() - new Date(s.time).getTime() < 30 * 60000 ? s.hr : null);
    const rr = live?.rr ?? (s && Date.now() - new Date(s.time).getTime() < 30 * 60000 ? s.rr : null);
    if (hr) f.hr.value = hr;
    if (rr) f.rr.value = rr;
    $("checkinResult").innerHTML = hr || rr
      ? `<p class="muted">Filled from camera: ${hr ? "HR " + hr : ""} ${rr ? "RR " + rr : ""}. Camera values are estimates.</p>`
      : `<p class="muted">No recent Body Scan. Open Body Scan, start the camera and save a scan first.</p>`;
  });

  $("checkinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const rec = {};
    new FormData(f).forEach((v, k) => {
      if (k === "notes") rec[k] = v;
      else if (v !== "") rec[k] = Number(v);
    });
    // Evaluate against baseline BEFORE adding (so baseline = previous readings)
    const results = Health.METRICS.filter((m) => m.src === "checkins" && rec[m.key] != null)
      .map((m) => ({ m, v: rec[m.key], e: Health.evaluate(m.key, rec[m.key], crew(), Health.baseline(m.key, crew(), false)) }));
    Store.add("checkins", rec);

    $("checkinResult").innerHTML = results.length
      ? `<div class="result-grid">${results.map(({ m, v, e }) => `
          <span>${m.label}</span><b>${Health.fmt(v, m)}</b><span class="pill ${e.level}">${LEVEL_TEXT[e.level]}</span>
          ${e.reasons.length ? `<span class="why">${esc(e.reasons.join(", "))}</span>` : ""}`).join("")}
        </div>
        <p class="hint mt">Saved ${new Date().toLocaleTimeString()}. ${Store.list("checkins", crew()).length > 5 ? "Compared with your personal baseline and general ranges." : "Personal baseline starts after 5 check-ins; until then only general ranges are used."} See the Dashboard for recommended actions.</p>`
      : `<p class="muted">Saved (no numeric readings entered).</p>`;
    f.reset();
    resetRanges(f);
  });

  // ================= Body Scan =================
  Camera.setup({ video: $("video"), overlay: $("overlay") });
  const stageMsg = (m) => { $("stageMsg").textContent = m; $("stageMsg").style.display = m ? "flex" : "none"; };

  $("camBtn").addEventListener("click", async () => {
    if (Camera.running) {
      Camera.stop();
      $("camBtn").textContent = "Start Camera";
      stageMsg("Camera off");
      return;
    }
    $("camBtn").disabled = true;
    try {
      await Camera.start(stageMsg);
      $("camBtn").textContent = "Stop Camera";
    } catch (err) {
      stageMsg("Could not start: " + err.message + ". Check camera permission and internet connection (models load online).");
    }
    $("camBtn").disabled = false;
  });

  [["togPose", "pose"], ["togHands", "hands"], ["togFace", "face"]].forEach(([id, k]) =>
    $(id).addEventListener("change", (e) => (Camera.toggles[k] = e.target.checked)));
  $("togSkeleton").addEventListener("change", (e) => $("stage").classList.toggle("skeleton", e.target.checked));

  Camera.onUpdate((l) => {
    $("vHr").textContent = l.hr ?? "--";
    $("vHrQ").textContent = l.hr ? (l.hrQuality > 0.25 ? "good signal" : "weak signal - hold still") : "needs ~10 s";
    $("vRr").textContent = l.rr ?? "--";
    $("vBlink").textContent = l.blinkRate ?? "--";
    $("vPerclos").textContent = l.perclos ?? "--";
    $("vTilt").textContent = l.shoulderTilt ?? "--";
    $("vHead").textContent = l.headTilt ?? "--";
    $("vFps").textContent = l.fps;
    $("vTracked").textContent = l.tracked;
  });

  $("saveScanBtn").addEventListener("click", () => {
    if (!Camera.running) return flash($("scanMsg"), "Start the camera first.", false);
    const l = Camera.live;
    Store.add("scans", {
      hr: l.hr, hrQuality: Math.round(l.hrQuality * 100) / 100, rr: l.rr, blinkRate: l.blinkRate,
      perclos: l.perclos, shoulderTilt: l.shoulderTilt, headTilt: l.headTilt,
    });
    flash($("scanMsg"), "Scan saved.");
  });

  // ================= Exercise =================
  let exTimer = null;
  $("exStart").addEventListener("click", () => {
    if (!Camera.running) {
      $("exCue").textContent = "Start the camera on the Body Scan page first (it stays on when you switch pages).";
      return;
    }
    Exercise.begin($("exType").value);
    $("exStart").disabled = true;
    $("exStop").disabled = false;
    $("exType").disabled = true;
    const t0 = Date.now();
    exTimer = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      $("exTime").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }, 500);
  });

  $("exStop").addEventListener("click", () => {
    const r = Exercise.finish();
    clearInterval(exTimer);
    $("exStart").disabled = false;
    $("exStop").disabled = true;
    $("exType").disabled = false;
    const names = { squat: "Squats", raise: "Lateral arm raises", curl: "Bicep curls", rom: "Shoulder mobility test" };
    Store.add("exercise", {
      type: names[r.type], minutes: Math.round((r.seconds / 60) * 10) / 10, reps: r.reps, source: "camera",
      bestAngle: r.type === "rom" ? null : r.best, romL: r.romL, romR: r.romR,
    });
    $("exCue").textContent = r.type === "rom"
      ? `Saved. Shoulder range: left ${r.romL ?? "--"} deg, right ${r.romR ?? "--"} deg.`
      : `Saved: ${r.reps} reps in ${r.seconds} s.`;
    renderExercise();
  });

  Exercise.onUpdate((s) => {
    $("exReps").textContent = s.reps;
    $("exAngle").textContent = s.angle != null ? s.angle + " deg" : "--";
    $("exBest").textContent = s.best != null ? (typeof s.best === "number" ? s.best + " deg" : s.best) : "--";
    if (s.active) $("exCue").textContent = s.cue;
  });

  $("manualEx").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    Store.add("exercise", { type: f.type.value, minutes: Number(f.minutes.value), reps: 0, source: "manual" });
    f.minutes.value = "";
    renderExercise();
  });

  function renderExercise() {
    const target = Number(D().mission.exTarget) || 0;
    const min = Health.exerciseMinutesOn(crew(), new Date());
    $("exTodayMin").textContent = min;
    $("exTarget").textContent = target;
    $("exBar").style.width = Math.min(100, target ? (min / target) * 100 : 0) + "%";
    const today = new Date().toDateString();
    const list = Store.list("exercise", crew()).filter((x) => new Date(x.time).toDateString() === today).reverse();
    $("exList").innerHTML = list.length
      ? list.map((x) => `<li>${esc(x.type)}<span>${x.reps ? x.reps + " reps · " : ""}${x.minutes} min · ${fmtTime(x.time)}</span></li>`).join("")
      : "<li><span>Nothing logged today</span></li>";
  }

  // ================= PVT =================
  PVT.setup({ box: $("pvtBox"), text: $("pvtText"), bar: $("pvtProgress") }, (r) => {
    const before = Health.baseline("meanRT", crew(), false);
    Store.add("pvt", r);
    const e = Health.evaluate("meanRT", r.meanRT, crew(), before);
    const el = Health.evaluate("lapses", r.lapses, crew(), Health.baseline("lapses", crew(), true));
    const lvl = Health.worst(e.level, el.level);
    $("pvtResult").innerHTML = `
      <div class="result-grid">
        <span>Mean reaction time</span><b>${r.meanRT} ms</b><span class="pill ${e.level}">${LEVEL_TEXT[e.level]}</span>
        <span>Median</span><b>${r.medianRT} ms</b><span></span>
        <span>Fastest 10% / Slowest 10%</span><b>${r.fastest10} / ${r.slowest10} ms</b><span></span>
        <span>Lapses (>= ${PVT.LAPSE} ms)</span><b>${r.lapses}</b><span class="pill ${el.level}">${LEVEL_TEXT[el.level]}</span>
        <span>False starts</span><b>${r.falseStarts}</b><span></span>
        <span>Performance score</span><b>${r.score}%</b><span></span>
      </div>
      <p class="body-text mt">${lvl === "ok"
        ? "Alertness looks normal for you."
        : lvl === "none" ? "Result saved." : "Alertness is lower than usual. Take extra care with complex or safety-critical tasks, and check your sleep and workload."}</p>
      ${before ? `<p class="hint">Your baseline: ${Math.round(before.mean)} ms over ${before.n} tests.</p>` : `<p class="hint">Personal baseline starts after 5 tests.</p>`}`;
    $("pvtStart").textContent = "Start Test";
    renderPvtList();
  });

  $("pvtStart").addEventListener("click", () => {
    if (PVT.running) { PVT.cancel(); $("pvtStart").textContent = "Start Test"; return; }
    $("pvtStart").textContent = "Cancel";
    PVT.start(Number($("pvtLen").value));
  });

  function renderPvtList() {
    const list = Store.list("pvt", crew()).slice(-8).reverse();
    $("pvtList").innerHTML = list.length
      ? list.map((p) => `<li>${fmtTime(p.time)}<span>${p.meanRT} ms · ${p.lapses} lapses · ${p.score}%</span></li>`).join("")
      : "<li><span>No tests yet</span></li>";
  }

  // ================= Symptoms =================
  $("symptomForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const rec = Object.fromEntries(new FormData(f));
    rec.severity = Number(rec.severity);
    rec.posture = Camera.running ? Camera.live.values : {};
    Store.add("symptoms", rec);
    f.reset();
    resetRanges(f);
    flash($("symMsg"), rec.severity >= 7 ? "Saved. Severity 7+: inform the Crew Medical Officer." : "Saved.");
    renderSymptoms();
  });

  function renderSymptoms() {
    const rows = Store.list("symptoms", crew()).slice(-25).reverse();
    $("symTable").innerHTML = rows.length
      ? rows.map((r) => {
          const lvl = r.severity >= 7 ? "alert" : r.severity >= 4 ? "watch" : "ok";
          return `<tr><td>${fmtTime(r.time)}</td><td>${esc(r.symptom)}${r.notes ? `<div class="hint">${esc(r.notes)}</div>` : ""}</td>
            <td>${esc(r.area)}</td><td><span class="pill ${lvl}">${r.severity}</span></td><td>${esc(r.duration)}</td>
            <td><button class="del" data-del="symptoms:${r.id}" title="Delete">x</button></td></tr>`;
        }).join("")
      : '<tr><td colspan="6" class="muted">No symptoms logged</td></tr>';
  }

  // delete buttons anywhere
  document.addEventListener("click", (e) => {
    const d = e.target.dataset?.del;
    if (!d) return;
    const [col, id] = d.split(":");
    Store.remove(col, id);
    render();
  });

  // ================= Trends =================
  const extraMetrics = [
    { key: "_exercise", label: "Exercise (min/day)" },
    { key: "_symptoms", label: "Symptom severity" },
    { key: "_scanHr", label: "Camera heart rate" },
    { key: "_blink", label: "Blink rate (camera)" },
  ];
  $("trendMetric").innerHTML =
    Health.METRICS.map((m) => `<option value="${m.key}">${m.label}</option>`).join("") +
    extraMetrics.map((m) => `<option value="${m.key}">${m.label}</option>`).join("");
  $("trendMetric").addEventListener("change", renderTrends);
  $("trendRange").addEventListener("change", renderTrends);
  $("recordType").addEventListener("change", renderRecords);

  function renderTrends() {
    const key = $("trendMetric").value;
    const since = Date.now() - Number($("trendRange").value) * 86400000;
    const canvas = $("trendChart");
    let pts = [], opts = {}, note = "";

    if (Health.byKey[key]) {
      const m = Health.byKey[key];
      pts = Health.values(key, crew()).filter((p) => p.t.getTime() >= since);
      const base = Health.baseline(key, crew(), false);
      pts.forEach((p) => {
        const lv = Health.evaluate(key, p.v, crew(), base).level;
        p.color = lv === "alert" ? Chart.COLORS.alert : lv === "watch" ? Chart.COLORS.watch : undefined;
      });
      if (base) opts.band = { lo: base.mean - 2 * base.sd, hi: base.mean + 2 * base.sd };
      opts.lines = [];
      if (m.watch[0] > 0) opts.lines.push({ v: m.watch[0], label: "low", color: Chart.COLORS.watch });
      if (!m.noHigh) opts.lines.push({ v: m.watch[1], label: "high", color: Chart.COLORS.watch });
      note = `${m.why} Shaded band = your normal range (baseline +/- 2 SD). Dashed = general watch limits.`;
    } else if (key === "_exercise") {
      const days = {};
      Store.list("exercise", crew()).filter((x) => new Date(x.time).getTime() >= since).forEach((x) => {
        const d = new Date(x.time); d.setHours(12, 0, 0, 0);
        days[d.getTime()] = (days[d.getTime()] || 0) + (Number(x.minutes) || 0);
      });
      pts = Object.entries(days).map(([t, v]) => ({ t: new Date(+t), v: Math.round(v) })).sort((a, b) => a.t - b.t);
      const target = Number(D().mission.exTarget) || 0;
      opts = { bars: true, lines: target ? [{ v: target, label: "target", color: Chart.COLORS.watch }] : [] };
      pts.forEach((p) => (p.color = p.v < target * 0.75 ? Chart.COLORS.watch : undefined));
      note = "Daily exercise minutes vs the mission target.";
    } else if (key === "_symptoms") {
      pts = Store.list("symptoms", crew()).filter((s) => new Date(s.time).getTime() >= since)
        .map((s) => ({ t: new Date(s.time), v: s.severity, color: s.severity >= 7 ? Chart.COLORS.alert : s.severity >= 4 ? Chart.COLORS.watch : undefined }));
      opts = { bars: true };
      note = "Severity of each logged symptom.";
    } else {
      const field = key === "_scanHr" ? "hr" : "blinkRate";
      pts = Store.list("scans", crew()).filter((s) => s[field] != null && new Date(s.time).getTime() >= since)
        .map((s) => ({ t: new Date(s.time), v: s[field] }));
      note = "From saved Body Scans (camera estimates).";
    }
    Chart.draw(canvas, pts, opts);
    $("trendNote").textContent = note;
    renderRecords();
  }

  const RECORD_COLS = {
    checkins: [["time", "Time"], ["hr", "HR"], ["sys", "Sys"], ["dia", "Dia"], ["spo2", "SpO2"], ["temp", "Temp"], ["rr", "RR"], ["sleep", "Sleep"], ["mood", "Mood"], ["stress", "Stress"], ["fatigue", "Fatigue"], ["notes", "Notes"]],
    symptoms: [["time", "Time"], ["symptom", "Symptom"], ["area", "Area"], ["severity", "Severity"], ["duration", "Duration"], ["notes", "Notes"]],
    pvt: [["time", "Time"], ["duration", "Length (s)"], ["meanRT", "Mean RT"], ["medianRT", "Median"], ["lapses", "Lapses"], ["falseStarts", "False starts"], ["score", "Score %"]],
    exercise: [["time", "Time"], ["type", "Type"], ["minutes", "Minutes"], ["reps", "Reps"], ["romL", "ROM L"], ["romR", "ROM R"], ["source", "Source"]],
    scans: [["time", "Time"], ["hr", "HR"], ["rr", "RR"], ["blinkRate", "Blinks/min"], ["perclos", "Eyes closed %"], ["shoulderTilt", "Shoulder tilt"], ["headTilt", "Head tilt"]],
  };

  function renderRecords() {
    const type = $("recordType").value;
    const cols = RECORD_COLS[type];
    const rows = Store.list(type, crew()).slice().reverse();
    $("recordTable").innerHTML = `<thead><tr>${cols.map(([, h]) => `<th>${h}</th>`).join("")}<th></th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `<tr>${cols.map(([k]) => `<td>${k === "time" ? fmtTime(r.time) : esc(r[k] ?? "")}</td>`).join("")}
        <td><button class="del" data-del="${type}:${r.id}" title="Delete">x</button></td></tr>`).join("")
        : `<tr><td colspan="${cols.length + 1}" class="muted">No records</td></tr>`}</tbody>`;
  }

  function download(name, text, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $("exportCsv").addEventListener("click", () => {
    const type = $("recordType").value;
    const cols = [["crew", "Crew"], ...RECORD_COLS[type]];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = D()[type].slice().sort((a, b) => a.time.localeCompare(b.time))
      .map((r) => cols.map(([k]) => q(k === "crew" ? Store.crewName(r.crewId) : r[k])).join(","));
    download(`sys-astro-${type}.csv`, [cols.map(([, h]) => q(h)).join(","), ...rows].join("\n"), "text/csv");
  });
  $("exportJson").addEventListener("click", () =>
    download(`sys-astro-backup-${new Date().toISOString().slice(0, 10)}.json`, Store.exportJson(), "application/json"));

  // ================= Space Weather =================
  $("swRefresh").addEventListener("click", () => {
    $("swText").textContent = "Refreshing...";
    SpaceWeather.refresh(true);
  });
  SpaceWeather.onChange(() => render());

  function renderWeather() {
    const s = SpaceWeather.state;
    const st = SpaceWeather.status();
    $("swBanner").className = "status-banner " + (st ? st.level : "none");
    $("swLevel").textContent = st ? (st.level === "ok" ? "Nominal" : LEVEL_TEXT[st.level]) : "Unavailable";
    $("swText").textContent = st ? `${st.title}. ${st.text} ${st.action}` : (s?.error || "Loading...");
    $("swSource").textContent = s?.fetched
      ? `Fetched ${new Date(s.fetched).toLocaleString()} from ${s.source || "NASA"}.${s.error ? " " + s.error : ""}`
      : (s?.error || "");

    const li = (items, f) => items.length ? items.slice().reverse().slice(0, 12).map(f).join("") : "<li><span>None in the last 30 days</span></li>";
    $("swFlr").innerHTML = li(s?.flr || [], (x) => `<li><b>${esc(x.classType || "?")}</b><span>${fmtTime(x.peakTime || x.beginTime)}${x.sourceLocation ? " · " + esc(x.sourceLocation) : ""}</span></li>`);
    $("swSep").innerHTML = li(s?.sep || [], (x) => `<li>SEP event<span>${fmtTime(x.eventTime)}</span></li>`);
    $("swGst").innerHTML = li(s?.gst || [], (x) => `<li><b>Kp ${SpaceWeather.maxKp(x)}</b><span>${fmtTime(x.startTime)}</span></li>`);
  }

  // ================= Settings =================
  function renderSettings() {
    const f = $("missionForm"), m = D().mission;
    f.name.value = m.name; f.type.value = m.type; f.start.value = m.start;
    f.exTarget.value = m.exTarget; f.apiKey.value = m.apiKey || "";
    $("crewList").innerHTML = D().crew.map((c) => `<li>
        <input type="text" value="${esc(c.name)}" data-crew-name="${c.id}" />
        <input type="text" value="${esc(c.role || "")}" data-crew-role="${c.id}" placeholder="Role" />
        <button class="del" data-crew-del="${c.id}" title="Remove">x</button>
      </li>`).join("");
  }

  $("missionForm").type.addEventListener("change", (e) => {
    $("missionForm").exTarget.value = Store.EX_TARGETS[e.target.value] ?? 120;
  });

  $("missionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    Object.assign(D().mission, {
      name: f.name.value || "SYS-ASTRO Mission", type: f.type.value, start: f.start.value || D().mission.start,
      exTarget: Number(f.exTarget.value) || 0, apiKey: f.apiKey.value.trim(),
    });
    Store.save();
    flash($("missionMsg"), "Saved.");
    renderSidebar();
  });

  $("crewList").addEventListener("change", (e) => {
    const id = e.target.dataset.crewName || e.target.dataset.crewRole;
    const c = D().crew.find((x) => x.id === id);
    if (!c) return;
    if (e.target.dataset.crewName) c.name = e.target.value || c.name;
    else c.role = e.target.value;
    Store.save();
    renderSidebar();
  });

  $("crewList").addEventListener("click", (e) => {
    const id = e.target.dataset.crewDel;
    if (!id) return;
    if (D().crew.length === 1) return alertMsg("At least one crew member is needed.");
    if (!confirm(`Remove ${Store.crewName(id)} and all their records?`)) return;
    D().crew = D().crew.filter((c) => c.id !== id);
    Store.COLLECTIONS.forEach((k) => (D()[k] = D()[k].filter((r) => r.crewId !== id)));
    if (crew() === id) D().currentCrew = D().crew[0].id;
    Store.save();
    render();
  });

  $("crewForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const c = { id: Store.uid(), name: f.name.value.trim(), role: f.role.value.trim() };
    D().crew.push(c);
    D().currentCrew = c.id;
    Store.save();
    f.reset();
    render();
  });

  $("demoBtn").addEventListener("click", () => {
    Store.loadDemo();
    go("dashboard");
  });

  $("clearBtn").addEventListener("click", () => {
    if (!confirm("Delete ALL crew, mission settings and health records in this browser?")) return;
    Store.clearAll();
    go("dashboard");
  });

  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      Store.importJson(await file.text());
      go("dashboard");
    } catch (err) {
      alertMsg("Import failed: " + err.message);
    }
    e.target.value = "";
  });

  function alertMsg(m) { window.alert(m); }

  // ================= Start =================
  stageMsg("Camera off");
  if (!Store.persistent) console.warn("localStorage unavailable - data will not be saved");
  go("dashboard");
  SpaceWeather.refresh();
  setInterval(() => { if (page === "dashboard") renderDashboard(); }, 60000);
  window.addEventListener("resize", () => { if (page === "trends") renderTrends(); });
})();
