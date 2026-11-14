# Crew Mirror

Offline, camera-based health check for astronauts on long missions. Built by Team SYS-ASTRO for NASA Space Apps Seoul 2026.
Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*.

> **Prototype, not a medical device.** Results are patterns, never diagnoses. Camera video never leaves the browser.

**Live demo:** https://mathlete0404-ops.github.io/NASA-APPS-PROJECT-SYS-ASTRO/ (built by `.github/workflows/ci.yml`; in the repo go to Settings → Pages → Source: *GitHub Actions* once) · **Demo video / slides:** _TBD_

A few minutes a day in front of a laptop or tablet, Crew Mirror:

- measures fatigue, fluid shift, balance, pain and recovery against **each astronaut's own baseline**,
- explains **why** the body is changing in space, and
- says **what to do next**, without needing Earth.

## What is implemented

| Area | Status | Where |
| --- | --- | --- |
| Landing site (hero with scroll-driven "daily check" build, how-it-works scroll story, mission-phase shelf, NASA-evidence section, crew medical officer (CMO) board, safety section) | ✅ | `web/src/site/` |
| App shell: sidebar dashboard, light/dark theme, works on phones (no horizontal scroll at 375 px) | ✅ | `web/src/App.tsx`, `web/src/styles.css` |
| Daily face scan (MediaPipe Face Landmarker in a Web Worker): rPPG heart-rate **estimate** (POS method), blink rate, PERCLOS, face-width ÷ IPD ratio, light/motion/presence quality gate → "No data" | ✅ | `web/src/vision/`, `web/src/engine/face.ts`, `rppg.ts` |
| Mood & sleep check-in, optional body mass | ✅ | `web/src/screens/DailyCheck.tsx` |
| Personal-baseline status engine (first 7 good sessions, robust z, Watch/Act, 3-in-a-row → Act, per-metric floor) | ✅ | `web/src/engine/status.ts`, `server/app/engine.py` |
| Danger-sign screen (always first) → symptom triage (nerve / possible fracture / severe pain / patterns) with bone-loss weighting by days in microgravity | ✅ | `web/src/engine/triage.ts`, `server/app/engine.py` |
| Body map, press & move tests, "Why does it hurt?" cards (7 regions), relief exercises with stop rules | ✅ (2D body map) | `web/src/screens/Report.tsx`, `web/src/content/` |
| Balance test (Pose Landmarker): sway eyes open / closed / tandem (% shoulder width), 5× sit-to-stand, "safe to walk / EVA?" verdict | ✅ | `web/src/screens/Balance.tsx`, `web/src/engine/balance.ts` |
| Trends with baseline band | ✅ | `web/src/screens/Trends.tsx` |
| **3D body** (Z-Anatomy → Blender → Draco GLB): 1,064 tappable bones, muscles, nerves, discs and skin regions; layers, x-ray, peel-through picking, search, problem highlights. Sex-specific anatomy removed | ✅ | `ingest/blender/export_body.py`, `web/src/body3d/`, `web/src/screens/Body.tsx` |
| **Point to pain** on camera (Pose + Hand Landmarker; fingertip → body part, works facing away for the back) | ✅ | `web/src/engine/pointing.ts`, `web/src/components/PointToPain.tsx` |
| **Where does it come from?** referred-pain source finder (muscle / joint / disc / nerve / bone), shown on the 3D body | ✅ | `web/src/content/sources.ts` |
| **Exercise coach** (MediaPipe 3D world landmarks): squat, lunge, arm raise, calf raise, sit-to-stand; reps, joint angles, form cues, pain before/after, 3D JSON/CSV export | ✅ | `web/src/engine/coach.ts`, `web/src/screens/Coach.tsx` |
| **Breathing rate** estimate in the face scan | ✅ | `web/src/engine/resp.ts` |
| **Plan**: today's actions with reasons, phase exercise plan, nutrition targets, food log, close-the-gap suggestions | ✅ | `web/src/engine/plan.ts`, `web/src/content/nutrition.ts`, `web/src/screens/Plan.tsx` |
| **Calendar**: checks, pain, balance, workouts, mission events, streak | ✅ | `web/src/screens/Calendar.tsx` |
| **Accounts & cloud sync** (Supabase auth + RLS; works offline without an account) | ✅ code · needs a project | `web/src/data/cloud.ts`, `supabase/migrations/` |
| **Settings** (profile, mission, nutrition targets, scan length, theme, account, data export) | ✅ | `web/src/screens/Settings.tsx` |
| NASA evidence: Inspiration4 CBC + CMP analysis (OSD-569, OSD-575), offline data.nasa.gov catalog with live search through the server | ✅ | `ingest/`, `web/src/screens/Evidence.tsx` |
| Radiation context + cumulative dose estimate | ✅ (published rates) | `web/src/content/mission.ts` |
| **Solar radiation storm card**: live NOAA SWPC ≥10 MeV proton flux → NOAA S-scale (S1–S5), phase-aware rule-based actions (shelter / suspend EVA / tell the CMO), 24 h chart, last reading kept for offline use ("Last known", never "Quiet" when there is no data) | ✅ | `web/src/engine/spaceweather.ts`, `web/src/components/SpaceWeatherCard.tsx` |
| CI + static deploy: tests (web and server), typecheck, production build, GitHub Pages | ✅ workflow · needs Pages enabled | `.github/workflows/ci.yml` |
| CMO view: all crew, worst first, reasons; delayed downlink to Earth (light-time) | ✅ | `web/src/screens/Medical.tsx` |
| Habitat server (FastAPI + SQLite): same rules in Python, sync, crew overview, downlink, NASA search | ✅ | `server/` |
| Offline PWA (service worker, bundled models) | ✅ (production build) | `web/public/sw.js` |

## Run locally

Requirements: Node 20+ and Python 3.11+.

```bash
# 1. Web app (http://localhost:5173)
cd web
npm install
npm run models        # optional: download the 2 MediaPipe models (~9.5 MB) for fully offline use
npm run dev
```

```bash
# 2. Habitat server (http://localhost:8000; the web app proxies /api to it)
python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt
cd server && ../.venv/bin/uvicorn app.main:app --reload --port 8000
```

The web app works **without** the server: everything is stored in IndexedDB on the device, and writes queue in an outbox until the server is reachable. The header shows "Link" / "Solo".

Tests (the browser and server engines run the **same** shared cases in `shared/*.json`):

```bash
cd web && npm test
cd server && ../.venv/bin/python -m pytest -q
```

Rebuild the NASA data snapshots (optional; outputs are committed):

```bash
.venv/bin/python ingest/osdr_inspiration4.py   # OSD-569 / OSD-575 → data/osdr_baseline_evidence.json
.venv/bin/python ingest/nasa_catalog.py        # data.nasa.gov CKAN → data/nasa_catalog.json
```

Environment variables (all optional): `VITE_HABITAT_URL` (web; default `/api`), `BASE` (web build base path, e.g. `/crew-mirror/`), `CREW_MIRROR_DB` (server SQLite path).

Rebuild the 3D body (optional; the GLBs are committed). Needs Blender 4.x and the Z-Anatomy template (~87 MB):

```bash
mkdir -p data/raw/zanatomy && curl -L -o data/raw/zanatomy/Z-Anatomy.zip https://github.com/Z-Anatomy/Models-of-human-anatomy/raw/master/Z-Anatomy.zip
cd data/raw/zanatomy && unzip Z-Anatomy.zip Z-Anatomy/Startup.blend && cd -
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --disable-autoexec data/raw/zanatomy/Z-Anatomy/Startup.blend --python ingest/blender/export_body.py -- web/public/models
```

Cloud accounts: the team project is **`crew-mirror`** (Supabase, Seoul `ap-northeast-2`), with the schema from `supabase/migrations/` applied. `web/.env.local` (gitignored) holds its URL and **publishable** key; copy `web/.env.example` on a new machine. Every table uses row-level security: users see only their own rows, and a crew medical officer sees their own mission's crew. The medical-officer role is **never self-assigned**. A sign-up can only *request* it, and an admin approves it in the Supabase SQL editor:

```sql
update public.profiles set is_cmo = true where call_sign = 'MS2' and mission_code = 'ARES-1';
```

In the Supabase dashboard, set **Auth → URL Configuration → Site URL** to the app's address (e.g. `http://localhost:5173` or the live site). For a live demo, you can turn off **Confirm email** so new accounts can sign in immediately.

For a different project, set:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Static build: `cd web && npm run build` → `web/dist/` (no server needed; the demo crew loads on first open).

## How the rules work

- **Baseline** = the first 7 good-quality sessions. z = (value − median) / max(1.4826 × MAD, floor). The floor is the smallest meaningful change for that metric (`shared/metrics.json`), so a perfectly steady baseline cannot turn noise into alarms.
- **Status**: |z| > 2 → Watch; |z| > 3 or Watch 3 sessions in a row → Act; failed quality check → **No data** (never "Fine").
- **Triage order**: danger signs → numbness/spreading tingling (nerve) → weakness → possible fracture (bony spot, can't bear weight, swelling) → severe pain → patterns. Rules, not AI, so every result lists its reasons.
- **Bone-loss weighting**: estimated weight-bearing bone loss ≈ 1 %/month in microgravity. At weight-bearing sites the pain level that triggers a CMO referral drops from 8/10 by 1 point per 2 % estimated loss (minimum 5/10).

## Design

The UI uses a "layered surfaces" style shared with the team's NullBase project: calm information cards, plus ink-bordered interactive surfaces on a hard teal/violet offset layer that lift on hover and sink on press. It also uses Space Grotesk / Inter / JetBrains Mono, mono kickers, dark grid hero sections and light/dark themes. The code here was written for this project during the hackathon; no NullBase code or logo is included. Camera views always draw only landmark meshes on a dark background.

## Known limitations

- **3D body**: one adult body model, and sex-specific anatomy is removed on purpose. Region tags come from names plus body height, so a few edge structures may sit in a neighbouring region. The 2D map stays as a low-power fallback.
- **Cloud accounts**: connected to the `crew-mirror` project. RLS was tested with throwaway users: own-rows only, medical officer reads only their mission, no self-promotion, no writing as another user. A real email sign-up was not tested end to end, because confirmation emails go to real inboxes.
- **Balance tests** are disabled while floating (there is no "up"); they run pre-flight and after landing.
- **Camera measures are not clinically validated.** The rPPG heart rate is labelled "estimate". Thresholds (light 50–230, motion, peak quality ≥ 0.3) are engineering choices tested on synthetic signals, not on astronauts.
- **Range of motion** is measured for the shoulder in the coach (arm raise + "It hurts here"). Other joints still use the slider.
- **Ghost coach** (replaying a recorded correct rep) and the finger-tap test are not built.
- **Food values** are approximate demo numbers, and the targets are defaults for a crew nutritionist to set.
- **RadLab** and the Environmental Data App are linked as evidence. Their data are not ingested; dose rates are published averages with citations.
- **Solar storm card** reads Earth-orbit GOES data from NOAA (not NASA). Far from Earth the real flux differs, so it is context only and defers to vehicle dosimetry and mission storm rules. Without a network it shows the last saved reading, labelled "Last known".
- The data.nasa.gov API sometimes timed out during ingest, so the offline catalog is a partial snapshot (76 datasets).
- Demo crew history is **synthetic** and labelled as such in the app.

## Use of AI tools

See `docs/AI_USE.md`. Code generation is acknowledged in this README, in `docs/AI_USE.md` and in the HTML `<meta name="generator">`.

## References

| Resource | Used for | License |
| --- | --- | --- |
| NASA OSDR OSD-569 (Inspiration4 CBC) — https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 | Personal-baseline evidence (`ingest/osdr_inspiration4.py`, Evidence page, landing) | NASA open data |
| NASA OSDR OSD-575 (Inspiration4 CMP) — https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 | Same | NASA open data |
| data.nasa.gov catalog (CKAN API) — https://data.nasa.gov | Offline NASA Evidence Library, live search | NASA open data |
| RadLab Portal — https://visualization.osdr.nasa.gov/radlab/gui/overview/ | Radiation evidence link | NASA open data |
| NOAA Space Weather Prediction Center: GOES integral proton flux (`services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json`) and the NOAA Space Weather Scales — https://www.swpc.noaa.gov/noaa-scales-explanation | Solar radiation storm card (live level, S-scale thresholds) | US government data, public domain; not NASA |
| OSDR Environmental Data App — https://visualization.osdr.nasa.gov/eda/ | Headache / CO₂ card evidence link | NASA open data |
| NASA Life Sciences Portal — https://data.nasa.gov/dataset/nasa-life-sciences-portal-nlsp | Card evidence links | NASA open data |
| MediaPipe Tasks Vision 1.2.3 + Face, Pose (lite) and Hand Landmarker models — https://ai.google.dev/edge/mediapipe | Face scan, balance, exercise coach, point-to-pain (on-device) | Apache-2.0 |
| Z-Anatomy — https://github.com/Z-Anatomy/Models-of-human-anatomy | 3D body (`web/public/models/*.glb`, exported with Blender) | CC BY-SA 4.0 (derivatives stay CC BY-SA 4.0) |
| BodyParts3D, The Database Center for Life Science — https://dbarchive.biosciencedbc.jp/en/bodyparts3d/ | Source of the Z-Anatomy meshes | CC BY-SA 2.1 JP |
| Blender 4.5 — https://www.blender.org | Headless export pipeline (tool only, not shipped) | GPL |
| three.js, @react-three/fiber, @react-three/drei | 3D viewer | MIT |
| Draco decoder (three.js examples) | Decompress the GLBs offline | Apache-2.0 |
| @supabase/supabase-js | Optional accounts & sync | MIT |
| Wang et al. 2017, "Algorithmic Principles of Remote PPG", IEEE TBME — https://doi.org/10.1109/TBME.2016.2609282 | rPPG POS method | Paper (method only) |
| Zeitlin et al. 2013 (Science), Hassler et al. 2014 (Science), Zhang et al. 2020 (Science Advances) | Radiation dose-rate context | Papers (values cited) |
| NASA articles: Astronauts' spines; Walk the line; Field Test (NTRS 20160013636); space nutrition & bone (NTRS 20080026254) | "Why it hurts" cards | Public NASA web pages |
| Chang et al., paraspinal muscle in ISS crew — https://pmc.ncbi.nlm.nih.gov/articles/PMC5588025 | Lower-back card | Paper (cited) |
| React 19, Vite 8, TypeScript, Vitest | Web app | MIT |
| idb-keyval | IndexedDB storage | Apache-2.0 |
| lucide-react | Icons | ISC |
| Inter, Space Grotesk, JetBrains Mono (Google Fonts) | Typography | SIL OFL 1.1 |
| FastAPI, Uvicorn, httpx, pytest | Habitat server | MIT / BSD-3 |

Data are courtesy of the NASA Open Science Data Repository (https://osdr.nasa.gov/bio/repo)
Dataset metadata from data.nasa.gov

No NASA logo is used, and nothing here implies NASA endorsement.

## License

MIT (see `LICENSE`). Third-party data and models keep their own licenses (above).
