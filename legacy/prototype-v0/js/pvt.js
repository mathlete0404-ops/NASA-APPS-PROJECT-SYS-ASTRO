// Psychomotor Vigilance Test (PVT-B style): random 1-4 s waits, lapse = RT >= 355 ms,
// false start = response before stimulus or RT < 100 ms.
const PVT = (() => {
  const LAPSE = 355, FALSE_START = 100, TIMEOUT = 10000;
  let box, text, bar;
  let st = null; // test state
  let onDone = () => {};

  function setup(els, done) {
    box = els.box; text = els.text; bar = els.bar; onDone = done;
    box.addEventListener("pointerdown", (e) => { e.preventDefault(); respond(); });
    document.addEventListener("keydown", (e) => {
      if (st && e.code === "Space") { e.preventDefault(); respond(); }
    });
  }

  function start(seconds) {
    st = { seconds, t0: performance.now(), rts: [], falseStarts: 0, phase: "wait", stimT: 0, timer: null, raf: null };
    box.focus();
    show("", "");
    schedule();
    tickProgress();
  }

  function schedule() {
    if (!st) return;
    const elapsed = (performance.now() - st.t0) / 1000;
    if (elapsed >= st.seconds) return finish();
    st.phase = "wait";
    show("", "");
    st.timer = setTimeout(stimulus, 1000 + Math.random() * 3000);
  }

  function stimulus() {
    if (!st) return;
    st.phase = "stim";
    st.stimT = performance.now();
    box.className = "pvt-box stim";
    const count = () => {
      if (!st || st.phase !== "stim") return;
      const ms = Math.round(performance.now() - st.stimT);
      text.textContent = ms;
      if (ms > TIMEOUT) { st.rts.push(TIMEOUT); return feedback("No response", "false"); }
      st.raf = requestAnimationFrame(count);
    };
    count();
  }

  function respond() {
    if (!st) return;
    if (st.phase === "wait") {
      clearTimeout(st.timer);
      st.falseStarts++;
      return feedback("Too early - wait for the counter", "false");
    }
    if (st.phase === "stim") {
      cancelAnimationFrame(st.raf);
      const rt = Math.round(performance.now() - st.stimT);
      if (rt < FALSE_START) { st.falseStarts++; return feedback(rt + " ms (too fast - anticipated)", "false"); }
      st.rts.push(rt);
      feedback(rt + " ms", "feedback");
    }
  }

  function feedback(msg, cls) {
    st.phase = "feedback";
    show(msg, cls);
    setTimeout(() => { if (st) schedule(); }, 1000);
  }

  function show(msg, cls) {
    box.className = "pvt-box" + (cls ? " " + cls : "");
    text.textContent = msg;
  }

  function tickProgress() {
    if (!st) { bar.style.width = "0"; return; }
    const p = Math.min(1, (performance.now() - st.t0) / 1000 / st.seconds);
    bar.style.width = p * 100 + "%";
    requestAnimationFrame(tickProgress);
  }

  function cancel() {
    if (!st) return;
    clearTimeout(st.timer);
    cancelAnimationFrame(st.raf);
    st = null;
    show("Test cancelled.", "");
  }

  function finish() {
    const s = st;
    st = null;
    clearTimeout(s.timer);
    const rts = s.rts.slice().sort((a, b) => a - b);
    const n = rts.length + s.falseStarts;
    if (!rts.length) { show("No valid responses recorded.", ""); return; }
    const mean = Math.round(rts.reduce((a, b) => a + b, 0) / rts.length);
    const k = Math.max(1, Math.round(rts.length * 0.1));
    const result = {
      duration: s.seconds, n,
      meanRT: mean,
      medianRT: rts.length % 2 ? rts[(rts.length - 1) / 2] : Math.round((rts[rts.length / 2 - 1] + rts[rts.length / 2]) / 2),
      fastest10: Math.round(rts.slice(0, k).reduce((a, b) => a + b, 0) / k),
      slowest10: Math.round(rts.slice(-k).reduce((a, b) => a + b, 0) / k),
      lapses: rts.filter((r) => r >= LAPSE).length,
      falseStarts: s.falseStarts,
    };
    result.score = Math.round((1 - (result.lapses + result.falseStarts) / Math.max(1, n)) * 100);
    show("Test complete", "");
    onDone(result);
  }

  return { setup, start, cancel, get running() { return !!st; }, LAPSE };
})();
