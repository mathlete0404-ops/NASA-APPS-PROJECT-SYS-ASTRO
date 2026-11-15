// Live space weather from NASA DONKI (flares, solar energetic particles, geomagnetic storms).
const SpaceWeather = (() => {
  const CACHE = "sysastro-sw";
  const MAX_AGE = 30 * 60 * 1000; // 30 min
  let state = null; // {fetched, flr, sep, gst, error, source}
  const listeners = [];

  const dateStr = (d) => d.toISOString().slice(0, 10);

  function urls(kind, start, end) {
    const key = (Store.data.mission.apiKey || "").trim() || "DEMO_KEY";
    return [
      `https://api.nasa.gov/DONKI/${kind}?startDate=${start}&endDate=${end}&api_key=${encodeURIComponent(key)}`,
      `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/${kind}?startDate=${start}&endDate=${end}`,
    ];
  }

  async function getJson(kind, start, end) {
    let lastErr;
    for (const u of urls(kind, start, end)) {
      try {
        const r = await fetch(u);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        return { data: text.trim() ? JSON.parse(text) : [], source: new URL(u).host };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  async function refresh(force = false) {
    if (!state) {
      try { state = JSON.parse(localStorage.getItem(CACHE)); } catch { state = null; }
    }
    if (!force && state && !state.error && Date.now() - state.fetched < MAX_AGE) {
      notify();
      return state;
    }
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400000);
    try {
      const [flr, sep, gst] = await Promise.all(
        ["FLR", "SEP", "GST"].map((k) => getJson(k, dateStr(start), dateStr(end)))
      );
      state = { fetched: Date.now(), flr: flr.data || [], sep: sep.data || [], gst: gst.data || [], source: flr.source };
      try { localStorage.setItem(CACHE, JSON.stringify(state)); } catch { /* ignore */ }
    } catch (e) {
      const cached = state && !state.error ? state : null;
      state = cached ? { ...cached, error: "Offline - showing cached data" } : { fetched: 0, flr: [], sep: [], gst: [], error: "Could not reach NASA DONKI (" + e.message + ")" };
    }
    notify();
    return state;
  }

  function maxKp(g) {
    return Math.max(0, ...(g.allKpIndex || []).map((k) => Number(k.kpIndex) || 0));
  }

  // Current advisory based on recent events
  function status() {
    if (!state || (!state.fetched && state.error)) return null;
    const now = Date.now();
    const H = 3600000;
    const deep = Store.data.mission.type !== "iss";

    const recentSep = (state.sep || []).filter((s) => now - new Date(s.eventTime).getTime() < 72 * H);
    const xFlares = (state.flr || []).filter((f) => /^X/i.test(f.classType || "") && now - new Date(f.peakTime || f.beginTime).getTime() < 24 * H);
    const storms = (state.gst || []).filter((g) => now - new Date(g.startTime).getTime() < 48 * H && maxKp(g) >= 7);

    if (recentSep.length) {
      return {
        level: deep ? "alert" : "watch",
        title: "Solar energetic particle event (last 72 h)",
        text: deep
          ? "High-energy protons from the Sun can sharply raise radiation dose outside Earth's magnetic field."
          : "Particle radiation is elevated. The ISS is partly protected by Earth's magnetic field, but EVAs are more exposed.",
        action: deep
          ? "Follow radiation flight rules: be ready to move to the shielded storm shelter and check dosimeter readings."
          : "Review EVA plans and check dosimeter readings.",
      };
    }
    if (xFlares.length) {
      return {
        level: "watch",
        title: `X-class solar flare (${xFlares[0].classType}) in the last 24 h`,
        text: "Strong flares can be followed by solar particle events within minutes to hours.",
        action: "Watch for particle event warnings and keep shelter procedures ready.",
      };
    }
    if (storms.length) {
      return {
        level: "watch",
        title: `Severe geomagnetic storm (Kp ${maxKp(storms[0])})`,
        text: "Strong storms can increase radiation at high-latitude orbit passes and disrupt communications.",
        action: "Expect possible comms issues. Check dosimeter readings.",
      };
    }
    return {
      level: "ok",
      title: "No major solar events",
      text: "No solar particle events in 72 h, no X-class flares in 24 h, no severe storms in 48 h.",
      action: "",
    };
  }

  function onChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach((fn) => fn(state)); }

  return { refresh, status, onChange, get state() { return state; }, maxKp };
})();
