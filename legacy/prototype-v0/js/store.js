// Data storage (browser localStorage). Everything stays on this device.
const Store = (() => {
  const KEY = "sysastro-v1";
  const COLLECTIONS = ["checkins", "symptoms", "pvt", "exercise", "scans"];
  const EX_TARGETS = { iss: 120, orion: 30, lunar: 60, mars: 120 };

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function empty() {
    return {
      crew: [{ id: "c1", name: "Crew Member 1", role: "Commander" }],
      currentCrew: "c1",
      mission: { name: "SYS-ASTRO Mission", type: "iss", start: todayStr(), exTarget: 120, apiKey: "" },
      checkins: [], symptoms: [], pvt: [], exercise: [], scans: [],
    };
  }

  let data = null;
  let persistent = true;

  function load() {
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    if (!data || !Array.isArray(data.crew)) data = empty();
    COLLECTIONS.forEach((c) => { if (!Array.isArray(data[c])) data[c] = []; });
    if (!data.crew.length) data.crew = empty().crew;
    if (!data.crew.find((c) => c.id === data.currentCrew)) data.currentCrew = data.crew[0].id;

    // Migrate symptoms from the earlier SYS-ASTRO version
    try {
      const old = JSON.parse(localStorage.getItem("sysastro-symptoms") || "null");
      if (Array.isArray(old) && old.length) {
        old.forEach((o) => data.symptoms.push({
          id: uid(), crewId: data.currentCrew, time: new Date(String(o.time).replace(" ", "T")).toISOString(),
          symptom: o.symptom, area: o.area, severity: Number(o.severity) || 0,
          duration: o.duration, notes: (o.crew ? `[${o.crew}] ` : "") + (o.notes || ""), posture: o.posture || {},
        }));
        localStorage.removeItem("sysastro-symptoms");
        save();
      }
    } catch { /* ignore */ }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      persistent = true;
    } catch {
      persistent = false;
    }
    return persistent;
  }

  function add(collection, record) {
    const r = { id: uid(), crewId: data.currentCrew, time: new Date().toISOString(), ...record };
    data[collection].push(r);
    save();
    return r;
  }

  function remove(collection, id) {
    data[collection] = data[collection].filter((r) => r.id !== id);
    save();
  }

  // Records for a crew member, oldest first
  function list(collection, crewId = data.currentCrew) {
    return data[collection]
      .filter((r) => r.crewId === crewId)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function crewName(id) {
    return data.crew.find((c) => c.id === id)?.name || "Unknown";
  }

  function missionDay() {
    const start = new Date(data.mission.start + "T00:00:00");
    const d = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
    return isFinite(d) ? d : 1;
  }

  function exportJson() {
    return JSON.stringify(data, null, 2);
  }

  function importJson(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.crew)) throw new Error("Not a SYS-ASTRO backup file");
    data = Object.assign(empty(), parsed);
    data.mission = Object.assign(empty().mission, parsed.mission || {});
    COLLECTIONS.forEach((c) => { if (!Array.isArray(data[c])) data[c] = []; });
    if (!data.crew.length) data.crew = empty().crew;
    if (!data.crew.find((c) => c.id === data.currentCrew)) data.currentCrew = data.crew[0].id;
    save();
  }

  function clearAll() {
    data = empty();
    save();
  }

  // ---------- Fictional demo data for presentations ----------
  function loadDemo() {
    const crew = [
      { id: "d1", name: "Cmdr. Rivera (demo)", role: "Commander" },
      { id: "d2", name: "Dr. Okafor (demo)", role: "Crew Medical Officer" },
      { id: "d3", name: "Eng. Sato (demo)", role: "Flight Engineer" },
    ];
    const rand = (a, b) => a + Math.random() * (b - a);
    const r1 = (x) => Math.round(x * 10) / 10;
    const base = {
      d1: { hr: 62, sys: 118, dia: 76, spo2: 98, temp: 36.9, rr: 14, sleep: 6.8 },
      d2: { hr: 58, sys: 112, dia: 72, spo2: 98.5, temp: 36.8, rr: 13, sleep: 7.0 },
      d3: { hr: 66, sys: 122, dia: 79, spo2: 97.8, temp: 37.0, rr: 15, sleep: 6.5 },
    };
    const days = 21;
    const now = new Date();
    // timestamps later than "now" are pulled back to a few minutes ago
    const at = (daysAgo, h, m = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      d.setHours(h, m, 0, 0);
      const t = Math.min(d.getTime(), now.getTime() - (20 - h / 2) * 60000);
      return new Date(t).toISOString();
    };
    const future = (daysAgo, h) => daysAgo === 0 && h > now.getHours();

    // drop the untouched default crew member
    data.crew = data.crew.filter((c) => !(c.id === "c1" && !COLLECTIONS.some((k) => data[k].some((r) => r.crewId === "c1"))));

    crew.forEach((c) => {
      if (!data.crew.find((x) => x.id === c.id)) data.crew.push(c);
      COLLECTIONS.forEach((k) => (data[k] = data[k].filter((r) => r.crewId !== c.id)));
      const b = base[c.id];

      for (let i = days; i >= 0; i--) {
        // Eng. Sato: sleep debt + rising stress + slower reactions in the last 4 days
        const decline = c.id === "d3" && i <= 3 ? (4 - i) * 0.7 : 0;
        // Dr. Okafor: fever-like reading today
        const fever = c.id === "d2" && i === 0;

        data.checkins.push({
          id: uid(), crewId: c.id, time: at(i, 7, 30),
          hr: Math.round(b.hr + rand(-3, 3) + decline * 3 + (fever ? 16 : 0)),
          sys: Math.round(b.sys + rand(-5, 5)), dia: Math.round(b.dia + rand(-4, 4)),
          spo2: r1(Math.min(100, b.spo2 + rand(-0.6, 0.6))),
          temp: r1(b.temp + rand(-0.15, 0.15) + (fever ? 1.4 : 0)),
          rr: Math.round(b.rr + rand(-1, 1)),
          sleep: r1(Math.max(3, b.sleep + rand(-0.6, 0.6) - decline * 0.8)),
          sleepQ: Math.round(Math.max(1, 4 - decline * 0.7 + rand(-0.5, 0.5))),
          caffeine: Math.round(rand(1, 3) + decline * 0.5),
          mood: Math.round(Math.max(1, Math.min(5, 4 + rand(-0.6, 0.6) - decline * 0.5))),
          stress: Math.round(Math.max(1, Math.min(10, 3 + rand(-1, 1) + decline * 1.4))),
          fatigue: Math.round(Math.max(1, Math.min(10, 3 + rand(-1, 1) + decline * 1.5 + (fever ? 5 : 0)))),
          workload: Math.round(5 + rand(-1, 2) + decline),
          water: r1(rand(2, 2.8)),
          isolation: Math.round(Math.max(1, Math.min(5, 2 + rand(-0.5, 0.5) + decline * 0.4))),
          notes: "",
        });

        if (i % 2 === 0) {
          const mean = 255 + rand(-12, 12) + decline * 35;
          data.pvt.push({
            id: uid(), crewId: c.id, time: at(i, 8), duration: 180, n: 54,
            meanRT: Math.round(mean), medianRT: Math.round(mean - 8),
            fastest10: Math.round(mean - 55), slowest10: Math.round(mean + 120 + decline * 40),
            lapses: Math.max(0, Math.round(rand(0, 2) + decline * 2)), falseStarts: Math.round(rand(0, 1.4)),
            score: 0,
          });
          const p = data.pvt[data.pvt.length - 1];
          p.score = Math.round((1 - (p.lapses + p.falseStarts) / p.n) * 100);
        }

        if (!future(i, 15)) data.exercise.push({
          id: uid(), crewId: c.id, time: at(i, 15), type: "Treadmill",
          minutes: Math.round(rand(35, 50) - decline * 8), reps: 0, source: "manual",
        });
        if (!future(i, 17)) data.exercise.push({
          id: uid(), crewId: c.id, time: at(i, 17), type: "Resistance device",
          minutes: Math.round(rand(50, 70) - decline * 10), reps: 0, source: "manual",
        });
      }
    });

    data.symptoms.push(
      { id: uid(), crewId: "d1", time: at(6, 10), symptom: "Back pain", area: "Back", severity: 4, duration: "More than 1 day", notes: "Lower back, common in microgravity", posture: {} },
      { id: uid(), crewId: "d2", time: at(0, 6, 50), symptom: "Fever / Chills", area: "Whole body", severity: 6, duration: "1-6 hours", notes: "Woke up feeling warm", posture: {} },
      { id: uid(), crewId: "d2", time: at(0, 7), symptom: "Headache", area: "Head", severity: 5, duration: "1-6 hours", notes: "", posture: {} },
      { id: uid(), crewId: "d3", time: at(1, 22), symptom: "Sleep problems", area: "Mind / Mood", severity: 6, duration: "More than 1 day", notes: "Hard to fall asleep after late shift", posture: {} },
      { id: uid(), crewId: "d3", time: at(0, 9), symptom: "Trouble concentrating", area: "Mind / Mood", severity: 7, duration: "6-24 hours", notes: "", posture: {} },
    );

    const s = new Date(now);
    s.setDate(s.getDate() - 42);
    data.mission.start = s.toISOString().slice(0, 10);
    data.currentCrew = "d3";
    save();
  }

  load();

  return {
    get data() { return data; },
    get persistent() { return persistent; },
    EX_TARGETS, COLLECTIONS, uid, save, add, remove, list, crewName, missionDay,
    exportJson, importJson, clearAll, loadDemo,
  };
})();
