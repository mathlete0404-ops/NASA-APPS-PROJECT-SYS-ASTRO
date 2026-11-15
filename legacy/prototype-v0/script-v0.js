// SYS-ASTRO - frontend only. Tracking runs in the browser (MediaPipe JS),
// symptom log is saved in the browser (localStorage).

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3";
const MODELS = "https://storage.googleapis.com/mediapipe-models";
const STORE_KEY = "sysastro-symptoms";

const $ = (id) => document.getElementById(id);
const video = $("video");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

let PoseLandmarker, HandLandmarker, FaceLandmarker, draw;
let pose, hands, face;
let lastTime = performance.now();
let lastVideoTime = -1;
let latestValues = {};

// ===================== Tracking =====================
async function init() {
  const vision = await import(`${MP}/vision_bundle.mjs`);
  ({ PoseLandmarker, HandLandmarker, FaceLandmarker } = vision);
  draw = new vision.DrawingUtils(ctx);

  const fileset = await vision.FilesetResolver.forVisionTasks(`${MP}/wasm`);
  const base = (path) => ({ modelAssetPath: `${MODELS}/${path}`, delegate: "GPU" });

  [pose, hands, face] = await Promise.all([
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: base("pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"),
      runningMode: "VIDEO",
      numPoses: 1,
    }),
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: base("hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"),
      runningMode: "VIDEO",
      numHands: 2,
    }),
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: base("face_landmarker/face_landmarker/float16/latest/face_landmarker.task"),
      runningMode: "VIDEO",
      numFaces: 1,
    }),
  ]);

  $("status").textContent = "Ready";
  $("startBtn").disabled = false;
}

$("startBtn").addEventListener("click", async () => {
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
    });
  } catch (err) {
    $("status").textContent = "Camera blocked: " + err.message;
    return;
  }
  video.addEventListener("loadeddata", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    $("startBtn").disabled = true;
    $("status").textContent = "Tracking";
    requestAnimationFrame(loop);
  }, { once: true });
});

$("togSkeleton").addEventListener("change", (e) => {
  document.querySelector(".stage").classList.toggle("skeleton", e.target.checked);
});

function loop() {
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const ts = performance.now();

    const poseRes = $("togPose").checked ? pose.detectForVideo(video, ts) : null;
    const handRes = $("togHands").checked ? hands.detectForVideo(video, ts) : null;
    const faceRes = $("togFace").checked ? face.detectForVideo(video, ts) : null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const lms of poseRes?.landmarks ?? []) {
      draw.drawConnectors(lms, PoseLandmarker.POSE_CONNECTIONS, { color: "#00ff88", lineWidth: 4 });
      draw.drawLandmarks(lms, { color: "#ffffff", radius: 3 });
    }

    (handRes?.landmarks ?? []).forEach((lms, i) => {
      const side = handRes.handedness[i][0].categoryName;
      const color = side === "Left" ? "#ff8800" : "#0088ff";
      draw.drawConnectors(lms, HandLandmarker.HAND_CONNECTIONS, { color, lineWidth: 3 });
      draw.drawLandmarks(lms, { color: "#ffffff", radius: 2 });
    });

    for (const lms of faceRes?.faceLandmarks ?? []) {
      draw.drawConnectors(lms, FaceLandmarker.FACE_LANDMARKS_CONTOURS, { color: "#c8c8c8", lineWidth: 1 });
    }

    updatePanel(poseRes, handRes, faceRes);
  }
  requestAnimationFrame(loop);
}

function updatePanel(poseRes, handRes, faceRes) {
  const now = performance.now();
  $("fps").textContent = Math.round(1000 / (now - lastTime));
  lastTime = now;

  $("bodyCount").textContent = poseRes?.landmarks.length ?? 0;
  $("handCount").textContent = handRes?.landmarks.length ?? 0;
  $("faceCount").textContent = faceRes?.faceLandmarks.length ?? 0;

  const xyz = (p) => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) });
  const values = {};

  const body = poseRes?.landmarks[0];
  if (body) {
    values["Nose"] = xyz(body[0]);
    values["L Shoulder"] = xyz(body[11]);
    values["R Shoulder"] = xyz(body[12]);
    values["L Wrist"] = xyz(body[15]);
    values["R Wrist"] = xyz(body[16]);
  }
  (handRes?.landmarks ?? []).forEach((lms, i) => {
    values[`${handRes.handedness[i][0].categoryName} Index`] = xyz(lms[8]);
  });
  latestValues = values;

  const lines = Object.entries(values).map(
    ([n, p]) => `${n.padEnd(11)} x ${p.x.toFixed(2)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(2)}`
  );
  $("values").textContent = lines.length ? lines.join("\n") : "No one detected";
}

// ===================== Tabs =====================
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab, .tab-page").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "history") loadHistory();
  });
});

// ===================== Storage =====================
function getSymptoms() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function setSymptoms(items) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

// ===================== Log Symptom =====================
$("sevRange").addEventListener("input", (e) => ($("sevVal").textContent = e.target.value));

$("symptomForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const entry = Object.fromEntries(new FormData(form));
  entry.severity = Number(entry.severity);
  entry.id = Date.now();
  entry.time = new Date().toLocaleString("sv-SE"); // YYYY-MM-DD HH:MM:SS
  entry.posture = latestValues; // tracking snapshot at log time

  const ok = setSymptoms([...getSymptoms(), entry]);
  const crew = entry.crew;
  form.reset();
  form.crew.value = crew;
  $("sevVal").textContent = "5";
  $("saveMsg").textContent = ok ? "Saved." : "Save failed - browser storage blocked";
  setTimeout(() => ($("saveMsg").textContent = ""), 2500);
});

// ===================== History =====================
let history = [];

function loadHistory() {
  history = getSymptoms();

  const filter = $("filterCrew");
  const current = filter.value;
  const crews = [...new Set(history.map((h) => h.crew))];
  filter.innerHTML = '<option value="">All crew</option>' +
    crews.map((c) => `<option>${esc(c)}</option>`).join("");
  filter.value = crews.includes(current) ? current : "";

  renderHistory();
}

function renderHistory() {
  const crew = $("filterCrew").value;
  const rows = history.filter((h) => !crew || h.crew === crew).reverse();

  $("sumTotal").textContent = rows.length;
  $("sumAvg").textContent = rows.length
    ? (rows.reduce((s, r) => s + r.severity, 0) / rows.length).toFixed(1)
    : "--";
  $("sumHigh").textContent = rows.filter((r) => r.severity >= 7).length;
  const counts = {};
  rows.forEach((r) => (counts[r.symptom] = (counts[r.symptom] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  $("sumCommon").textContent = top ? top[0] : "--";

  $("historyBody").innerHTML = rows.length
    ? rows.map((r) => {
        const level = r.severity >= 7 ? "high" : r.severity >= 4 ? "mid" : "low";
        return `<tr>
          <td>${esc(r.time)}</td>
          <td>${esc(r.crew)}</td>
          <td>${esc(r.symptom)}</td>
          <td>${esc(r.area)}</td>
          <td><span class="sev ${level}">${r.severity}</span></td>
          <td>${esc(r.duration)}</td>
          <td>${esc(r.notes)}</td>
          <td><button class="del" data-id="${r.id}" title="Delete">x</button></td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="8">No entries yet</td></tr>';
}

$("filterCrew").addEventListener("change", renderHistory);

$("historyBody").addEventListener("click", (e) => {
  const id = Number(e.target.dataset.id);
  if (!id) return;
  setSymptoms(getSymptoms().filter((s) => s.id !== id));
  loadHistory();
});

$("exportBtn").addEventListener("click", () => {
  const cols = ["time", "crew", "symptom", "area", "severity", "duration", "notes"];
  const csv = [cols.join(",")]
    .concat(history.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "sys-astro-symptoms.csv";
  a.click();
});

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

init().catch((err) => {
  $("status").textContent = "Failed to load: " + err.message;
  console.error(err);
});