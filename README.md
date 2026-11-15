# Crew Mirror

Offline, camera-based health check for astronauts on long missions. Built by Team SYS-ASTRO for NASA Space Apps Seoul 2026.
Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*.

> **Prototype, not a medical device.** Results are patterns, never diagnoses. Camera video never leaves the browser.

**Live app:** https://mathlete0404-ops.github.io/NASA-APPS-PROJECT-SYS-ASTRO/ (built by `.github/workflows/ci.yml`; in the repo go to Settings → Pages → Source: *GitHub Actions* once) · **Demo video / slides:** _TBD_

**30-second ad:** https://mathlete0404-ops.github.io/NASA-APPS-PROJECT-SYS-ASTRO/ad/ (video: [`ad/crew-mirror-ad.mp4`](https://mathlete0404-ops.github.io/NASA-APPS-PROJECT-SYS-ASTRO/ad/crew-mirror-ad.mp4)) · **iOS app:** simulator build on the [Releases page](https://github.com/mathlete0404-ops/NASA-APPS-PROJECT-SYS-ASTRO/releases) (see [iOS app](#ios-app-xcode))

A few minutes a day in front of a laptop or tablet, Crew Mirror:

- measures fatigue, fluid shift, balance, pain and recovery against **each astronaut's own baseline**,
- explains **why** the body is changing in space, and
- says **what to do next**, without needing Earth.

## What is implemented

| Area | Status | Where |
| --- | --- | --- |
| Opens straight into the app with a short logo fade, then a **first-open setup** (who you are, how statuses work, first check), a **Getting started** checklist and an in-app **How to use** guide. No pre-filled data: every page says what will appear and how to start | ✅ | `web/src/screens/Welcome.tsx`, `web/index.html`, `web/src/boot.ts` |
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
| **Plan**: today's actions with reasons, phase exercise plan, NASA JSC-67378 nutrition targets, a space-food menu grouped by how it is stored (thermostabilized, rehydratable, irradiated, natural form, fresh on resupply), portions (all, ¾, ½, ¼), close-the-gap suggestions that respect the sodium limit | ✅ | `web/src/engine/plan.ts`, `web/src/content/nutrition.ts`, `web/src/screens/Plan.tsx` |
| **Scan a package**: photograph a food pouch; on-device text reading (Tesseract) matches the menu name or reads a nutrition panel, then you confirm the portion. The photo is never saved or sent | ✅ | `web/src/components/ScanFood.tsx`, `web/src/content/label.ts`, `web/src/vision/ocr.ts`, `web/public/ocr/` |
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
| **Crew pet** (own page): starts as an egg you hatch by tapping it three times after your first check, then grows from daily care (check, exercise, food, pain reports), never from health results; missing days make it sleepy, nothing is lost | ✅ | `web/src/engine/pet.ts`, `web/src/components/Pet.tsx`, `web/src/screens/PetPage.tsx` |
| **Daily check reminders**: morning reminder at a chosen time plus an optional 20:00 nudge if the check isn't done, planned 7 days ahead and re-planned after each check; a quiet "You haven't done today's check yet" line on Today. iOS: local notifications that arrive when the app is closed; web: shown only while the app is open | ✅ | `web/src/engine/reminders.ts`, `web/src/data/notify.ts`, `web/src/screens/Settings.tsx` |
| **Space weather at a glance**: one-line pill at the top of Today ("Space weather: Quiet", "Radiation storm S3: shelter rules apply", "Last known: Quiet" offline), using the storm card's saved reading; tap to jump to the card | ✅ | `web/src/components/SpaceWeatherPill.tsx` |
| **iOS app** (Capacitor 8, Swift Package Manager): same web app in a native shell, camera permission, models bundled for offline use | ✅ simulator · device needs signing | `web/ios/`, `web/capacitor.config.ts` |
| 30-second ad (v3): three.js space opening on real NASA/USGS planet maps, then one phone playing real captured app clips (face mesh, plan, package scan, 3D body, space weather, calendar, pain check, reminders, pet hatch), with an original synthesised soundtrack, rendered frame by frame to MP4 | ✅ | `ad/index.html`, `ad/capture/`, `docs/AD_DEMO_PLAN.md` |

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

In the Supabase dashboard, set **Auth → URL Configuration → Site URL** to the app's address (e.g. `http://localhost:5173` or the live site). You can turn off **Confirm email** so new accounts can sign in immediately.

For a different project, set:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Login and identity: see `docs/IDENTITY_PLAN.md` for the current design and proposed improvements.

Static build: `cd web && npm run build` → `web/dist/` (no server needed; first open shows a short setup that creates your own profile).

### iOS app (Xcode)
Needs Xcode 16+ (tested with Xcode 26.6). The first build needs internet once so Swift Package Manager can fetch Capacitor.
```bash
cd web
npm run ios          # downloads models if missing, builds, syncs, opens ios/App/App.xcodeproj
```
In Xcode pick the **App** scheme and an iPhone simulator, then Run. On a real iPhone, set your team under Signing & Capabilities. After changing web code, run `npm run ios:sync`.

**Download instead of building:** each [GitHub Release](https://github.com/mathlete0404-ops/NASA-APPS-PROJECT-SYS-ASTRO/releases) tagged `ios-v*` has `CrewMirror-iOS-Simulator.zip`. It is an unsigned **iOS Simulator build** (Mac only, not for a real iPhone). Unzip it, boot a simulator (Xcode → Open Developer Tool → Simulator), then:
```bash
xcrun simctl install booted App.app && xcrun simctl launch booted org.sysastro.crewmirror
```
A real iPhone needs Xcode signing: `cd web && npm run ios`, then set your team under Signing & Capabilities.

CI: `.github/workflows/ios.yml` builds the app on a macOS runner (Xcode 26.6) for pushes to `main` that touch `web/`, and publishes a Release when a tag `ios-v*` is pushed (`git tag ios-v0.1.1 && git push origin ios-v0.1.1`). The website workflow (`ci.yml`) ignores changes that only touch `web/ios/`, `ad/` or `docs/`, and the Pages site never contains the Xcode project.

### Ad video
The ad is live at https://mathlete0404-ops.github.io/NASA-APPS-PROJECT-SYS-ASTRO/ad/ (published with the site by `ci.yml`; after an ad-only change, run that workflow by hand from the Actions tab). Locally, open `ad/index.html` in Chrome to play the 30-second ad (press Replay to restart); it works straight from disk, no server needed. The rendered video is `ad/crew-mirror-ad.mp4`.
To re-capture the app clips, run the web app (`npm run dev` in `web/`) and `python ad/capture/capture.py` (Playwright). The capture writes a 21-day history for one astronaut into the capture browser's IndexedDB only (`ad/capture/fixture.js`); nothing is added to the app.

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
- **Balance tests** are disabled while weightless (there is no "up"); they run pre-flight and after landing.
- **Camera measures are not clinically validated.** The rPPG heart rate is labelled "estimate". Thresholds (light 50–230, motion, peak quality ≥ 0.3) are engineering choices tested on synthetic signals, not on astronauts.
- **Range of motion** is measured for the shoulder in the coach (arm raise + "It hurts here"). Other joints still use the slider.
- **Ghost coach** (replaying a recorded correct rep) and the finger-tap test are not built.
- **Food values** are estimates per serving from comparable foods, kept conservative on protein; NASA does not publish per-item ISS menu nutrition openly. A mission would load its own food database. The targets are defaults for a crew nutritionist to set.
- **Scan a package** reads printed text (the menu name or a nutrition panel). It does not estimate calories from a photo of a plate, which would not be reliable offline. Foods added from a label that are not on the menu are kept on this device; cloud sync stores only the menu item and portion.
- **RadLab** and the Environmental Data App are linked as evidence. Their data are not ingested; dose rates are published averages with citations.
- **Solar storm card** reads Earth-orbit GOES data from NOAA (not NASA). Far from Earth the real flux differs, so it is context only and defers to vehicle dosimetry and mission storm rules. Without a network it shows the last saved reading, labelled "Last known".
- **Reminders on the web** appear only while Crew Mirror is open (no push server). The iPhone app schedules real local notifications 7 days ahead; if the app is not opened for a week, they stop until it is opened again.
- The data.nasa.gov API sometimes timed out during ingest, so the offline catalog is a partial snapshot (76 datasets).
- The app ships with **no data**. Each astronaut builds their own baseline over their first 7 daily checks; until then pages show what will appear and how to start. Saved data from older builds that contained a sample crew is dropped on load, and setup opens again.

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
| Capacitor 8 (@capacitor/core, @capacitor/ios, @capacitor/cli) — https://capacitorjs.com | iOS app shell | MIT |
| @capacitor/local-notifications 8.3 — https://capacitorjs.com/docs/apis/local-notifications | Daily check reminders in the iOS app (`web/src/data/notify.ts`) | MIT |
| Playwright + ffmpeg (imageio-ffmpeg) | Render the ad to MP4 (tools only, not shipped) | Apache-2.0 / LGPL |
| NASA Blue Marble Next Generation, December 2004 (Reto Stöckli, NASA Earth Observatory), via NASA SVS 12564 — https://svs.gsfc.nasa.gov/12564 | Ad: Earth day map (`ad/textures/earth_day.jpg`) | Public domain (NASA) |
| NASA SVS 3615 "Equirectangular Projected Earth" (Greg Shirah; Blue Marble NG + cloud composite) — https://svs.gsfc.nasa.gov/3615 | Ad: Earth cloud layer, extracted as the difference of the with/without-clouds stills (`ad/textures/earth_clouds.jpg`) | Public domain (NASA) |
| NASA SVS 4720 "CGI Moon Kit" (LRO LROC color map, Ernie Wright) — https://svs.gsfc.nasa.gov/4720 | Ad: Moon color map (`ad/textures/moon.jpg`) | Public domain (NASA) |
| USGS Astrogeology / NASA Viking MDIM2.1 global color mosaic (via Wikimedia Commons, `Mars_Viking_MDIM21_ClrMosaic_1km.jpg`) — https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m | Ad: Mars color map (`ad/textures/mars.jpg`) | Public domain (USGS/NASA) |
| MediaPipe canonical face model (`canonical_face_model.obj`, generic mesh, not a real person) — https://github.com/google-ai-edge/mediapipe/tree/master/mediapipe/modules/face_geometry/data | Ad: 478-point face mesh on the Daily check screen (`ad/data/face_mesh.js`) | Apache-2.0 |
| three.js r187 (bundled to `ad/vendor/three.min.js`) — https://threejs.org | Ad: space opening (WebGL) | MIT |
| Wang et al. 2017, "Algorithmic Principles of Remote PPG", IEEE TBME — https://doi.org/10.1109/TBME.2016.2609282 | rPPG POS method | Paper (method only) |
| Zeitlin et al. 2013 (Science), Hassler et al. 2014 (Science), Zhang et al. 2020 (Science Advances) | Radiation dose-rate context | Papers (values cited) |
| NASA articles: Astronauts' spines; Walk the line; Field Test (NTRS 20160013636); space nutrition & bone (NTRS 20080026254) | "Why it hurts" cards | Public NASA web pages |
| Chang et al., paraspinal muscle in ISS crew — https://pmc.ncbi.nlm.nih.gov/articles/PMC5588025 | Lower-back card | Paper (cited) |
| Tesseract.js 7.0.0 + tesseract.js-core 6.1.2 — https://github.com/naptha/tesseract.js | On-device package text reading (`web/public/ocr/`) | Apache-2.0 |
| Tesseract English LSTM model (`eng.traineddata`, best_int, via @tesseract.js-data/eng 1.0.0) — https://github.com/tesseract-ocr/tessdata_best | Same | Apache-2.0 |
| NASA OCHMO-TB-013 Rev C, Food and Nutrition technical brief — https://www.nasa.gov/wp-content/uploads/2023/03/food-and-nutrition-technical-brief-ochmo.pdf | ISS crew protein and sodium intake shown on the food card | Public NASA document (values cited) |
| NASA JSC-67378 (2020), Exploration nutrition requirements — https://ntrs.nasa.gov/citations/20205008306 | Default nutrition targets | Public NASA document (values cited) |
| USDA FoodData Central — https://fdc.nal.usda.gov | Per-serving estimates for comparable foods | Public domain (US government) |
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
