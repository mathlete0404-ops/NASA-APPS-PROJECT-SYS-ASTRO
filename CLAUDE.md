# Crew Mirror — project instructions for Claude Code

Read `docs/BUILD_OUTLINE.md` before starting any task. It is the team's full plan (features, data, architecture, rules, timeline, submission checklist).

## What this is

Crew Mirror is an offline, camera-based health check for astronauts on long missions, built by Team SYS-ASTRO for NASA Space Apps Seoul 2026 (challenge: "Create Health Monitoring Software for Astronauts on Space Missions").

A few minutes a day in front of a laptop or tablet, it measures fatigue, balance, pain and recovery against each astronaut's **own baseline**, explains *why* the body is changing in space, and tells them what to do next — without needing Earth.

## Hard deadlines (KST, UTC+9)

- Hackathon started Sat Nov 14, 09:00. Nothing in this repo may predate that.
- Team target: **submission-ready Sun Nov 15, 17:30**. Submit by **23:55** (official deadline 23:59).
- Prefer a working, demoable slice over breadth. Follow the priority order P0 → P3 in the outline.

## Stack

- **Web app** (`web/`): React + Vite + TypeScript (strict), installable PWA, IndexedDB cache.
  - MediaPipe `@mediapipe/tasks-vision` (Face Landmarker, Pose Landmarker, Hand Landmarker, Gesture Recognizer), each run in a **Web Worker** (detectForVideo blocks the main thread).
  - 3D body: react-three-fiber + drei, Z-Anatomy model exported to Draco-compressed `skeleton.glb` / `muscles.glb` in `web/public/models/`, lazy-loaded on the Body tab.
- **Habitat server** (`server/`): Python 3.11+, FastAPI, SQLite. Represents the computer on the spacecraft.
- **Ingest scripts** (`ingest/`): Python. OSDR (OSD-569, OSD-575), RadLab, data.nasa.gov `data.json` → SQLite.

## Target layout (create as needed)

```
web/            React app (screens, workers, 3D body)
server/         FastAPI app, rules engine, SQLite schema
ingest/         NASA data download + filtering scripts
data/           small processed CSV/SQLite snapshots (no raw dumps over ~20 MB)
docs/           BUILD_OUTLINE.md, AI_USE.md, data notes
```

## Non-negotiable rules

1. **Safety / medical**
   - Triage is **deterministic rules, not an AI model**, so every result shows its reasons.
   - The danger-sign screen always runs first (chest pain; sudden one-sided weakness/numbness, face drooping, slurred speech; sudden severe headache or vision change; back pain with leg numbness or bladder/bowel change; pain after a fall or impact). Any "yes" → "Act now: contact the crew medical officer" and **no exercises**.
   - Possible-fracture or nerve patterns → crew medical officer, never exercises.
   - Wording is "pattern", never "diagnosis". Every screen footer: "Prototype, not a medical device."
   - Low-quality measurements show **"No data"**, never "Fine".
2. **Privacy**: camera video never leaves the browser. Only derived numbers go to the server.
3. **Status engine**: baseline = first 7 sessions; z = (value − median) / (1.4826 × MAD); |z| > 2 → Watch; |z| > 3 or Watch 3 days in a row → Act.
4. **Event rules**
   - No NASA logo anywhere (the Space Apps event logo is different); never imply NASA endorsement; no NASA branding in AI-generated content.
   - No identifiable name, face or voice of anyone under 18 in the app, screenshots, demo or credits. Demos show landmark meshes on a dark background.
   - Everything user-facing and all docs in **English**.
   - Our code is MIT-licensed. Never commit secrets or personal data.
5. **AI-use log**: event rules require AI-generated code/data to be acknowledged. Append a one-line entry to `docs/AI_USE.md` for each meaningful AI-assisted change (date/time KST, tool, files, what it did).
6. **Credits**: every external dataset, model, library or image gets an entry in the README References section with link, what part of the app uses it, and its license. Z-Anatomy model files stay CC BY-SA 4.0 and must be credited.

## NASA data credit lines (use verbatim)

- OSDR: "Data are courtesy of the NASA Open Science Data Repository (https://osdr.nasa.gov/bio/repo)"
- RadLab: "Data and visualizations are courtesy of the RadLab Portal (https://visualization.osdr.nasa.gov/radlab/gui/overview/), Version #."
- Catalog: "Dataset metadata from data.nasa.gov"

## Working style

- Small, demoable increments; commit often with clear messages.
- Keep the app runnable at every commit (`npm run dev` in `web/`, `uvicorn` in `server/`).
- Update the README run steps whenever setup changes.
- When a feature can't be finished in time, leave a clear stub plus a note in README "Known limitations" — judges reward a clear blueprint and reasoning.
