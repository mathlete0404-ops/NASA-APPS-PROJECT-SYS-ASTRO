# SYS-ASTRO prototype v0 (archived)

The team's first prototype, written on Nov 14 before Crew Mirror. It is kept here as-is for the record and
because two of its ideas were carried into the main app (`web/`):

| Prototype feature | Where it lives now |
| --- | --- |
| Alertness test (PVT-B style reaction test, `js/pvt.js`) | `web/src/engine/pvt.ts`, `web/src/screens/Alertness.tsx` |
| Live NASA DONKI space weather (flares, particle events, storms, `js/spaceweather.js`) | `web/src/engine/donki.ts`, `web/src/components/SpaceWeatherCard.tsx` |

The rest (check-in, body scan, exercise counting, symptom log, charts, general health ranges) was rebuilt
in Crew Mirror with the personal-baseline status engine, so it is not carried over.

## What is here

A plain HTML + JavaScript app, no build step. Open `index.html` in a browser (serve it over `http://localhost`
for the camera).

| File | What it does |
| --- | --- |
| `index.html` | The pages: dashboard, check-in, body scan, exercise, alertness test, symptoms, trends, space weather, settings |
| `js/store.js` | localStorage data store |
| `js/health.js` | General-range checks, personal-baseline anomaly detection, trend rules |
| `js/chart.js` | Small canvas charts |
| `js/spaceweather.js` | NASA DONKI client (FLR, SEP, GST) with a 30-minute cache |
| `js/camera.js` | Camera, MediaPipe tracking, camera vitals, exercise rep counting |
| `js/pvt.js` | Psychomotor vigilance test |
| `js/app.js` | Wiring for all the pages |
| `script-v0.js` | The very first single-file tracker, before the split into modules |

## Known gaps

- The original `style.css` is not in this archive (the file was lost when the project folder was reset), so
  `index.html` loads unstyled.
- The MediaPipe model files (`face_landmarker.task`, `hand_landmarker.task`, `pose_landmarker_full.task`, ~21 MB)
  are not committed. The code loads them from Google's CDN; the main app has `npm run models` for offline use.
- Not maintained. Do not build on it; use `web/`.

NASA DONKI data: Space Weather Database Of Notifications, Knowledge, Information (NASA CCMC), via
`api.nasa.gov/DONKI` (the public `DEMO_KEY` unless a key is entered in Settings).
