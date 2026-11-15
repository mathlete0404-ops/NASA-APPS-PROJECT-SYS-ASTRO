// Minimal canvas charts (no libraries, works offline)
const Chart = (() => {
  const C = { line: "#1a2233", text: "#8a96ab", accent: "#6cf0ff", band: "rgba(108,240,255,0.08)", watch: "#ffcc33", alert: "#ff5555" };

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  // points: [{t: Date, v: number}]; opts: {band:{lo,hi}, lines:[{v,color,label}], unit, bars}
  function draw(canvas, points, opts = {}) {
    const { ctx, w, h } = setup(canvas);
    const pad = { l: 48, r: 16, t: 14, b: 28 };
    ctx.font = "11px Segoe UI, sans-serif";

    if (!points.length) {
      ctx.fillStyle = C.text;
      ctx.textAlign = "center";
      ctx.fillText("No data for this range", w / 2, h / 2);
      return;
    }

    const ts = points.map((p) => p.t.getTime());
    let t0 = Math.min(...ts), t1 = Math.max(...ts);
    if (t1 === t0) { t0 -= 43200000; t1 += 43200000; }

    const vals = points.map((p) => p.v);
    (opts.lines || []).forEach((l) => vals.push(l.v));
    if (opts.band) vals.push(opts.band.lo, opts.band.hi);
    let v0 = Math.min(...vals), v1 = Math.max(...vals);
    if (opts.bars) v0 = Math.min(0, v0);
    const span = v1 - v0 || 1;
    v0 -= span * 0.08; v1 += span * 0.08;
    if (opts.bars) v0 = Math.min(0, v0);

    const X = (t) => pad.l + ((t - t0) / (t1 - t0)) * (w - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - (v - v0) / (v1 - v0)) * (h - pad.t - pad.b);

    // grid + y labels
    ctx.strokeStyle = C.line;
    ctx.fillStyle = C.text;
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const v = v0 + ((v1 - v0) * i) / 4;
      const y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1), pad.l - 6, y + 4);
    }

    // x labels
    ctx.textAlign = "center";
    const n = Math.min(6, points.length);
    for (let i = 0; i < n; i++) {
      const t = t0 + ((t1 - t0) * i) / Math.max(1, n - 1);
      const d = new Date(t);
      ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, X(t), h - 8);
    }

    // baseline band
    if (opts.band) {
      ctx.fillStyle = C.band;
      const yTop = Y(opts.band.hi), yBot = Y(opts.band.lo);
      ctx.fillRect(pad.l, yTop, w - pad.l - pad.r, yBot - yTop);
    }

    // reference lines
    (opts.lines || []).forEach((l) => {
      ctx.strokeStyle = l.color || C.watch;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, Y(l.v)); ctx.lineTo(w - pad.r, Y(l.v)); ctx.stroke();
      ctx.setLineDash([]);
      if (l.label) {
        ctx.fillStyle = l.color || C.watch;
        ctx.textAlign = "left";
        ctx.fillText(l.label, pad.l + 4, Y(l.v) - 4);
      }
    });

    if (opts.bars) {
      const bw = Math.max(3, Math.min(24, (w - pad.l - pad.r) / points.length - 4));
      points.forEach((p) => {
        ctx.fillStyle = p.color || C.accent;
        const y = Y(p.v);
        ctx.fillRect(X(p.t.getTime()) - bw / 2, y, bw, Y(Math.max(0, v0)) - y);
      });
      return;
    }

    // line
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = X(p.t.getTime()), y = Y(p.v);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.lineWidth = 1;

    points.forEach((p) => {
      ctx.fillStyle = p.color || C.accent;
      ctx.beginPath();
      ctx.arc(X(p.t.getTime()), Y(p.v), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function spark(canvas, values, color = C.accent) {
    const { ctx, w, h } = setup(canvas);
    if (values.length < 2) return;
    const v0 = Math.min(...values), v1 = Math.max(...values);
    const span = v1 - v0 || 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - v0) / span) * (h - 4);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }

  return { draw, spark, COLORS: C };
})();
