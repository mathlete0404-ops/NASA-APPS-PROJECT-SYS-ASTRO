// Camera + MediaPipe tracking + camera-based vitals + exercise rep counting.
const Camera = (() => {
  const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3";
  const MODELS = "https://storage.googleapis.com/mediapipe-models";

  let vision, pose, hands, face, draw;
  let video, overlay, octx, sampler, sctx;
  let running = false, loading = null, stream = null;
  let lastVideoTime = -1, lastFrame = performance.now();
  const listeners = [];

  // Live results shared with the UI
  const live = {
    fps: 0, tracked: "", hr: null, hrQuality: 0, rr: null, blinkRate: null, perclos: null,
    shoulderTilt: null, headTilt: null, pose: null, poseWorld: null, values: {},
  };

  // ---------- signal buffers ----------
  const ppg = [];      // {t, g}
  const breath = [];   // {t, y}
  const blinks = [];   // timestamps
  const eyeSamples = []; // {t, closed}
  let eyeClosed = false;

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      vision = await import(`${MP}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${MP}/wasm`);
      const base = (path) => ({ modelAssetPath: `${MODELS}/${path}`, delegate: "GPU" });
      [pose, hands, face] = await Promise.all([
        vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: base("pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"),
          runningMode: "VIDEO", numPoses: 1,
        }),
        vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: base("hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"),
          runningMode: "VIDEO", numHands: 2,
        }),
        vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: base("face_landmarker/face_landmarker/float16/latest/face_landmarker.task"),
          runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true,
        }),
      ]);
    })();
    return loading;
  }

  function setup(els) {
    video = els.video;
    overlay = els.overlay;
    octx = overlay.getContext("2d");
    sampler = document.createElement("canvas");
    sctx = sampler.getContext("2d", { willReadFrequently: true });
  }

  async function start(msg) {
    msg("Loading tracking models (first time takes a moment)...");
    await load();
    draw = new vision.DrawingUtils(octx);
    msg("Starting camera...");
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
    video.srcObject = stream;
    await new Promise((res) => (video.onloadeddata = res));
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    sampler.width = Math.round(video.videoWidth / 2);
    sampler.height = Math.round(video.videoHeight / 2);
    running = true;
    msg("");
    requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    ppg.length = breath.length = blinks.length = eyeSamples.length = 0;
    Object.assign(live, { hr: null, rr: null, blinkRate: null, perclos: null, shoulderTilt: null, headTilt: null, pose: null });
  }

  const toggles = { pose: true, hands: true, face: true };

  function loop() {
    if (!running) return;
    if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
      lastVideoTime = video.currentTime;
      const ts = performance.now();
      const poseRes = toggles.pose ? pose.detectForVideo(video, ts) : null;
      const handRes = toggles.hands ? hands.detectForVideo(video, ts) : null;
      const faceRes = toggles.face ? face.detectForVideo(video, ts) : null;

      octx.clearRect(0, 0, overlay.width, overlay.height);
      const P = vision.PoseLandmarker, Hd = vision.HandLandmarker, F = vision.FaceLandmarker;

      for (const lms of poseRes?.landmarks ?? []) {
        draw.drawConnectors(lms, P.POSE_CONNECTIONS, { color: "#00e08a", lineWidth: 4 });
        draw.drawLandmarks(lms, { color: "#ffffff", radius: 3 });
      }
      (handRes?.landmarks ?? []).forEach((lms, i) => {
        const side = handRes.handedness[i][0].categoryName;
        draw.drawConnectors(lms, Hd.HAND_CONNECTIONS, { color: side === "Left" ? "#ff8800" : "#0088ff", lineWidth: 3 });
        draw.drawLandmarks(lms, { color: "#ffffff", radius: 2 });
      });
      for (const lms of faceRes?.faceLandmarks ?? []) {
        draw.drawConnectors(lms, F.FACE_LANDMARKS_CONTOURS, { color: "#c8c8c8", lineWidth: 1 });
      }

      process(ts, poseRes, handRes, faceRes);
      const dt = ts - lastFrame;
      lastFrame = ts;
      live.fps = Math.round(0.9 * live.fps + 0.1 * (1000 / Math.max(dt, 1)));
      listeners.forEach((fn) => fn(live));
    }
    requestAnimationFrame(loop);
  }

  // ---------- vitals ----------
  function process(ts, poseRes, handRes, faceRes) {
    const t = ts / 1000;
    const W = video.videoWidth, H = video.videoHeight;
    const body = poseRes?.landmarks?.[0] || null;
    const fl = faceRes?.faceLandmarks?.[0] || null;
    live.pose = body;
    live.tracked = [body && "body", handRes?.landmarks?.length && `${handRes.landmarks.length} hand`, fl && "face"].filter(Boolean).join(", ") || "none";

    // Values snapshot (saved with symptoms / scans)
    const xyz = (p) => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) });
    live.values = body ? { Nose: xyz(body[0]), "L Shoulder": xyz(body[11]), "R Shoulder": xyz(body[12]) } : {};

    // Posture
    if (body && body[11].visibility > 0.5 && body[12].visibility > 0.5) {
      live.shoulderTilt = angleDeg(body[11], body[12], W, H);
      live.headTilt = body[2].visibility > 0.5 && body[5].visibility > 0.5 ? angleDeg(body[2], body[5], W, H) : null;
      // breathing: vertical shoulder movement relative to shoulder width
      const sw = Math.hypot((body[11].x - body[12].x) * W, (body[11].y - body[12].y) * H);
      breath.push({ t, y: ((body[11].y + body[12].y) / 2) * H / sw });
    } else {
      live.shoulderTilt = live.headTilt = null;
    }
    trim(breath, t, 40);

    // rPPG: average green value of forehead + cheeks
    if (fl) {
      sctx.drawImage(video, 0, 0, sampler.width, sampler.height);
      const faceW = Math.hypot((fl[234].x - fl[454].x) * sampler.width, (fl[234].y - fl[454].y) * sampler.height);
      const r = Math.max(3, Math.round(faceW * 0.07));
      let sum = 0, n = 0;
      for (const idx of [151, 50, 280]) {
        const cx = Math.round(fl[idx].x * sampler.width), cy = Math.round(fl[idx].y * sampler.height);
        if (cx - r < 0 || cy - r < 0 || cx + r >= sampler.width || cy + r >= sampler.height) continue;
        const d = sctx.getImageData(cx - r, cy - r, r * 2, r * 2).data;
        for (let i = 0; i < d.length; i += 4) { sum += d[i + 1]; n++; }
      }
      if (n) ppg.push({ t, g: sum / n });

      // blinks
      const bs = faceRes.faceBlendshapes?.[0]?.categories || [];
      const score = (name) => bs.find((c) => c.categoryName === name)?.score ?? 0;
      const blink = (score("eyeBlinkLeft") + score("eyeBlinkRight")) / 2;
      const closed = eyeClosed ? blink > 0.35 : blink > 0.5; // hysteresis
      if (closed && !eyeClosed) blinks.push(t);
      eyeClosed = closed;
      eyeSamples.push({ t, closed });
    }
    trim(ppg, t, 15);
    while (blinks.length && t - blinks[0] > 60) blinks.shift();
    trim(eyeSamples, t, 60);

    // Update estimates ~2x per second
    if (!process.next || t > process.next) {
      process.next = t + 0.5;

      const span = ppg.length ? ppg[ppg.length - 1].t - ppg[0].t : 0;
      if (span > 8) {
        const est = spectralPeak(ppg.map((p) => ({ t: p.t, v: p.g })), 30, 0.75, 3.0);
        if (est) { live.hr = Math.round(est.freq * 60); live.hrQuality = est.quality; }
      } else { live.hr = null; live.hrQuality = 0; }

      const bspan = breath.length ? breath[breath.length - 1].t - breath[0].t : 0;
      if (bspan > 20) {
        const est = spectralPeak(breath.map((p) => ({ t: p.t, v: p.y })), 10, 0.1, 0.7);
        live.rr = est && est.quality > 0.15 ? Math.round(est.freq * 60) : null;
      } else live.rr = null;

      const espan = eyeSamples.length ? eyeSamples[eyeSamples.length - 1].t - eyeSamples[0].t : 0;
      if (espan > 15) {
        live.blinkRate = Math.round((blinks.length / espan) * 60);
        live.perclos = Math.round((eyeSamples.filter((s) => s.closed).length / eyeSamples.length) * 100);
      } else live.blinkRate = live.perclos = null;
    }

    Exercise.update(body, poseRes?.worldLandmarks?.[0] || null, t);
  }

  function angleDeg(a, b, W, H) {
    // tilt of the line a-b relative to horizontal (screen is mirrored, so flip sign)
    const dx = (b.x - a.x) * W, dy = (b.y - a.y) * H;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg > 90) deg -= 180;
    if (deg < -90) deg += 180;
    return Math.round(-deg * 10) / 10;
  }

  function trim(buf, t, sec) {
    while (buf.length && t - buf[0].t > sec) buf.shift();
  }

  // Resample to uniform rate, detrend, Hann window, scan DFT for dominant frequency in band
  function spectralPeak(samples, fs, fLo, fHi) {
    if (samples.length < 10) return null;
    const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
    const N = Math.floor((t1 - t0) * fs);
    if (N < 32) return null;
    const x = new Float64Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const t = t0 + i / fs;
      while (j < samples.length - 2 && samples[j + 1].t < t) j++;
      const a = samples[j], b = samples[j + 1];
      const f = (t - a.t) / ((b.t - a.t) || 1);
      x[i] = a.v + (b.v - a.v) * Math.min(1, Math.max(0, f));
    }
    // detrend with 1 s moving average removal (for HR) / linear for breathing
    const win = Math.max(3, Math.round(fs / fLo / 2));
    const y = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0, c = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(N - 1, i + win); k++) { s += x[k]; c++; }
      y[i] = (x[i] - s / c) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    }
    let best = 0, bestF = 0, total = 0;
    for (let f = fLo; f <= fHi; f += 1 / 60) {
      let re = 0, im = 0;
      const w = 2 * Math.PI * f / fs;
      for (let i = 0; i < N; i++) { re += y[i] * Math.cos(w * i); im -= y[i] * Math.sin(w * i); }
      const p = re * re + im * im;
      total += p;
      if (p > best) { best = p; bestF = f; }
    }
    if (!total) return null;
    // quality = share of power near the peak
    let near = 0;
    for (let f = bestF - 0.1; f <= bestF + 0.1; f += 1 / 60) {
      let re = 0, im = 0;
      const w = 2 * Math.PI * f / fs;
      for (let i = 0; i < N; i++) { re += y[i] * Math.cos(w * i); im -= y[i] * Math.sin(w * i); }
      near += re * re + im * im;
    }
    return { freq: bestF, quality: Math.min(1, near / total) };
  }

  return {
    setup, start, stop, live, toggles,
    get running() { return running; },
    onUpdate: (fn) => listeners.push(fn),
  };
})();

// ---------- Exercise rep counter ----------
const Exercise = (() => {
  const S = { type: "squat", active: false, reps: 0, phase: "up", startT: 0, angle: null, best: null, bestL: null, bestR: null, cue: "" };
  const listeners = [];

  // angle at b formed by a-b-c, using 3D world landmarks when available
  function angle(a, b, c) {
    const v1 = [a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)];
    const v2 = [c.x - b.x, c.y - b.y, (c.z || 0) - (b.z || 0)];
    const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const m = Math.hypot(...v1) * Math.hypot(...v2);
    return m ? (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI : null;
  }

  const DEF = {
    squat: { joints: [[23, 25, 27], [24, 26, 28]], down: 100, up: 160, invert: false,
      cue: { up: "Stand tall, then bend knees and lower your hips.", down: "Good depth. Push back up." } },
    raise: { joints: [[23, 11, 15], [24, 12, 16]], down: 40, up: 150, invert: true,
      cue: { up: "Lower arms slowly to your sides.", down: "Raise both arms out to the side, up to shoulder height or above." } },
    curl: { joints: [[11, 13, 15], [12, 14, 16]], down: 150, up: 50, invert: "curl",
      cue: { up: "Lower your forearms all the way.", down: "Curl your hands up toward your shoulders." } },
    rom: { joints: [[23, 11, 15], [24, 12, 16]], cue: {} },
  };

  function update(body, world, t) {
    if (!S.active) return;
    const d = DEF[S.type];
    const src = world || body;
    if (!body || !src) { S.cue = "Step back so your whole body is visible."; notify(); return; }

    const angles = d.joints.map(([a, b, c]) => {
      const vis = Math.min(body[a].visibility ?? 1, body[b].visibility ?? 1, body[c].visibility ?? 1);
      return vis > 0.5 ? angle(src[a], src[b], src[c]) : null;
    });
    const valid = angles.filter((x) => x != null);
    if (!valid.length) { S.cue = "Joints not visible - adjust your position or lighting."; notify(); return; }
    const avg = valid.reduce((s, x) => s + x, 0) / valid.length;
    S.angle = Math.round(avg);

    if (S.type === "rom") {
      if (angles[0] != null) S.bestL = Math.max(S.bestL || 0, Math.round(angles[0]));
      if (angles[1] != null) S.bestR = Math.max(S.bestR || 0, Math.round(angles[1]));
      S.best = `L ${S.bestL ?? "--"} / R ${S.bestR ?? "--"}`;
      S.cue = "Raise each arm out to the side as high as comfortable. Max angle is recorded.";
      notify();
      return;
    }

    if (S.type === "squat") {
      S.best = S.best == null ? S.angle : Math.min(S.best, S.angle);
      if (S.phase === "up" && avg < d.down) S.phase = "down";
      else if (S.phase === "down" && avg > d.up) { S.phase = "up"; S.reps++; }
    } else if (S.type === "raise") {
      S.best = S.best == null ? S.angle : Math.max(S.best, S.angle);
      if (S.phase === "up" && avg < d.down) S.phase = "down";        // arms at sides
      else if (S.phase === "down" && avg > d.up) { S.phase = "up"; S.reps++; } // arms raised
      S.cue = S.phase === "down" ? d.cue.down : d.cue.up;
      notify();
      return;
    } else if (S.type === "curl") {
      S.best = S.best == null ? S.angle : Math.min(S.best, S.angle);
      if (S.phase === "up" && avg > d.down) S.phase = "down";        // arm straight
      else if (S.phase === "down" && avg < d.up) { S.phase = "up"; S.reps++; }
      S.cue = S.phase === "down" ? d.cue.down : d.cue.up;
      notify();
      return;
    }
    S.cue = S.phase === "down" ? d.cue.down : d.cue.up;
    notify();
  }

  function begin(type) {
    Object.assign(S, { type, active: true, reps: 0, phase: type === "raise" ? "up" : "up", startT: performance.now(), angle: null, best: null, bestL: null, bestR: null, cue: "Get into position..." });
    notify();
  }

  function finish() {
    S.active = false;
    notify();
    return {
      type: S.type, reps: S.reps,
      seconds: Math.round((performance.now() - S.startT) / 1000),
      best: S.best,
      romL: S.bestL, romR: S.bestR,
    };
  }

  function notify() { listeners.forEach((fn) => fn(S)); }

  return { state: S, update, begin, finish, onUpdate: (fn) => listeners.push(fn) };
})();
