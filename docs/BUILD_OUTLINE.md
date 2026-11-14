# Crew Mirror — Build Outline

Team SYS-ASTRO · NASA Space Apps Seoul 2026 · Challenge: Create Health Monitoring Software for Astronauts on Space Missions · Nov 14, 2026

## 1. One-line pitch

Crew Mirror is an offline, camera-based health check for astronauts: a few minutes a day in front of a laptop or tablet, it measures fatigue, balance, pain and recovery against each astronaut's own baseline, explains *why* the body is changing in space, and tells them what to do next — without needing Earth.

**Key ideas judges should remember**

- **Personal baseline**, not population averages (Usual / Watch / Act / No data).
- **Mission phase aware**: pre-flight → transit (floating) → landing (G-transition) → Moon/Mars surface → return.
- **Video never leaves the device** (MediaPipe runs on-device; only numbers are stored).
- **Every card shows its NASA evidence** (OSDR, RadLab, data.nasa.gov).
- **Safety first**: danger signs always go to the crew medical officer, never to exercises.

## 2. Space context (use in the pitch)

| Phase | What happens to the body | What Crew Mirror focuses on |
| --- | --- | --- |
| Pre-flight | Normal Earth body | Record baseline: balance, strength, mass, diet, face scan |
| Transit (floating) | Weight-bearing bones lose ~1%/month without countermeasures; spine lengthens ~5 cm and back muscles shrink; people eat ~80% of needs; mass drops in first ~30 days | Exercise coach, food log, mass trend, pain check, face scan |
| Landing (G-transition) | Brain must relearn balance; motion sickness; muscle weakness | Balance test, "safe to walk / EVA?" check |
| Moon / Mars surface | Partial gravity (Mars ≈ 62% lower than Earth) | Balance trend, recovery plan |
| Return | Bone and muscle recovery is slow | Recovery tracking |

## 3. Features

### P0 — must ship

1. **Daily face scan (60 s)** — MediaPipe Face Landmarker (478 landmarks, 52 blendshapes): heart-rate estimate (rPPG, labelled "estimate"), blink rate / eye closure (fatigue), face-width ratio vs baseline (fluid shift). Bad light or low confidence → "No data", never "Fine".
2. **Mood & sleep check-in** — 3–4 sliders.
3. **Symptom check (MedIQ-style)** — tap the 3D body → pain / weakness / numbness / stiffness → intensity 0–10, type, onset, side, context (sleep, exercise, after EVA, after landing).
4. **Danger-sign screen (always first)** — chest pain; sudden one-sided weakness/numbness, face drooping, slurred speech; sudden severe headache or vision change; back pain with leg numbness or bladder/bowel change; pain after a fall or impact. Any yes → **Act now: contact crew medical officer**, no exercises.
5. **Movement & press test** — the 3D body shows where to press and how to move; result is a *pattern*, not a diagnosis:
   - press muscle belly hurts → muscle strain / inflammation pattern → exercises
   - pain when tightening against resistance → muscle/tendon irritation
   - pain on stretch → tightness/strain
   - joint range test → app saves the **painful angle** (thumbs-up gesture when it starts to hurt)
   - sharp pain on one bony spot / can't bear weight / swelling / after impact → **possible fracture → STOP → crew medical officer**
   - spreading tingling/numbness → nerve pattern → crew medical officer
   - Space twist: "possible bone" weight increases with mission day (bone loss).
6. **"Why does it hurt?" cards** — three parts: what space is doing → what your test showed → what helps. Write 6–8: lower back, neck, shoulder, knee, ankle/foot, headache & facial fullness.
7. **3D body (bones + muscles)** — Z-Anatomy model, tap-to-select, highlight, camera zoom to the painful structure, layer toggle (skin / muscle / bone), X-ray fade.
8. **Baseline status engine** — Usual / Watch / Act / No data for every metric.
9. **NASA evidence chips** — every card links to its dataset.

### P1 — should ship

10. **Guided relief exercises** — per region (lower back: knees-to-chest fetal tuck, cat-cow, bird-dog, dead bug; neck: chin tucks, side tilts; legs: squats, calf raises, balance hold). Each card: target muscles glow on 3D model, steps, reps/hold, stop rules, pain before/after.
11. **Ghost coach** — one recorded correct rep saved as landmark JSON, replayed as a skeleton beside the user's live skeleton; off joints turn red.
12. **Balance test** (pre-flight baseline + after landing): feet together eyes open / eyes closed, tandem stand (30 s each), tandem walk, 5× sit-to-stand. Metrics: hip & shoulder midpoint sway (scaled by shoulder width), path length, steps off line, sit-to-stand time.
13. **Radiation panel** — RadLab dose context + cumulative mission dose (optional NOAA solar-proton alert).

### P2 — nice to have

14. **Food log** — quick-pick pantry items; protein, energy, calcium, sodium, potassium, water, vitamin D checkbox as % of target (targets editable "set by crew nutritionist").
15. **Mass / muscle / bone trends** — manual SLAMMD mass entry vs pre-flight; muscle proxies (sit-to-stand, reps, loads, tape measurements); educational bone-change estimate (~1%/month at weight-bearing bones, lower when exercise + food targets are met).
16. **Delayed downlink** — messages to the Earth flight surgeon queued with simulated delay (Mars 4–24 min one-way).

### P3 — only if time

17. **Tomorrow's meal plan** — from pantry list, fills yesterday's gaps, more protein + fruit/veg, lower sodium.
18. **Touch-free control** — Gesture Recognizer (thumbs-up = confirm, palm = back).
19. **Finger-tap / reaction test** — Hand Landmarker.

## 4. MediaPipe usage map

| Task | Used for |
| --- | --- |
| Face Landmarker (+ blendshapes) | rPPG heart rate, blinks / eye closure, face-width ratio |
| Pose Landmarker (33 points) | Exercise coach, ghost coach, balance sway, range-of-motion angles, sit-to-stand |
| Hand Landmarker | Finger-tap test |
| Gesture Recognizer | "It hurts here" thumbs-up, touch-free navigation |

Run every task in a Web Worker (detectForVideo blocks the main thread). Package: `@mediapipe/tasks-vision`.

## 5. NASA data

| Data | Where | Used in |
| --- | --- | --- |
| Inspiration4 blood count (OSD-569) & metabolic panel (OSD-575) | osdr.nasa.gov | Blood-shift reference, "why personal baseline" evidence |
| RadLab | visualization.osdr.nasa.gov/radlab | Radiation panel |
| Environmental Data Application (CO2, humidity, temperature) | visualization.osdr.nasa.gov/eda | Headache / environment card |
| NASA Life Sciences Portal (LSDA) | data.nasa.gov catalog | Evidence links for bone, sleep, nutrition cards |
| data.nasa.gov catalog (`data.json`, CKAN search) | data.nasa.gov | In-app NASA Evidence Library, offline copy |
| NOAA GOES protons (optional, not NASA) | services.swpc.noaa.gov | Solar-storm shelter alert |

To do: open the official challenge page **Resources** tab and cross-check this list.

## 6. 3D body pipeline (timebox 1 hour)

1. Download Z-Anatomy (.blend or FBX, CC BY-SA 4.0).
2. Blender: keep skeleton + muscle collections; delete nerves, vessels, organs; Decimate ~0.2; **keep object names**.
3. Export Draco-compressed `skeleton.glb` and `muscles.glb`; lazy-load on the Body tab.
4. Front end: react-three-fiber + drei — raycast tap → mesh name → `region_map` → highlight red → `CameraControls` fly-to; layer toggle; X-ray opacity.
5. Fallback: major muscle groups only, or 2D SVG body map.
6. Credit: "Z-Anatomy — CC BY-SA 4.0"; edited model files stay CC BY-SA.

## 7. Architecture

```
Browser (React + Vite + TypeScript PWA)
 ├─ MediaPipe tasks-vision in Web Workers   (video stays here)
 ├─ react-three-fiber 3D body
 ├─ IndexedDB offline cache
 └─ sends numbers only
        │
Habitat server (FastAPI + SQLite)  = "on the spacecraft"
 ├─ status engine, triage rules, explanation cards
 ├─ NASA evidence library (offline data.json copy + live CKAN when online)
 └─ downlink queue to "Earth" with simulated delay
        │
Ingest scripts (Python): OSDR, RadLab, data.nasa.gov → SQLite
```

## 8. Data model

- `mission(crew_id, launch_date, phase, gravity)` — drives tests offered, bone weighting, card text
- `crew`, `session`
- `measurement(metric, value, unit, quality, source, ts)`
- `baseline(crew_id, metric, median, mad, n)`
- `alert(level, metric, message, action, ts)`
- `symptom_report(id, crew_id, ts, region, structure_name, kind, intensity, onset, side, context, red_flags[], triage_level)`
- `provocation_test(id, symptom_id, test_type, structure, hurt, pain_angle_deg, pattern)`
- `exercise(id, region, name, target_structures[], steps, reps, hold_s, stop_rules, pose_checks, source)`
- `exercise_session(id, crew_id, exercise_id, reps, form_score, pain_before, pain_after, ts)`
- `balance_test(id, crew_id, ts, phase, test_type, sway_rms, path_len, steps_off_line, duration_s, quality)`
- `food_item`, `food_log`, `nutrient_target`
- `body_mass(id, crew_id, ts, kg, source)` — pre-flight scale | SLAMMD
- `radiation(ts, dose_rate, source)`
- `reference(analyte, phase, mean, sd, dataset_id)`
- `region_map(structure_name, region)`
- `nasa_dataset(id, title, description, keywords, landing, download, modified)`
- `evidence(card_id, dataset_id)`

## 9. API endpoints

- `POST /checkins` · `GET /status/{crew}` · `GET /baseline/{crew}`
- `POST /symptoms` → triage level, reasons, contact, exercises
- `POST /symptoms/{id}/tests` → pattern + explanation card + next step
- `GET /exercises?region=` · `POST /exercise-sessions`
- `POST /balance-tests` → score vs baseline + safe to walk / EVA
- `POST /food-log` · `GET /nutrition/today` · `GET /meal-plan/tomorrow`
- `POST /body-mass` · `GET /trends/{crew}`
- `GET /radiation` · `GET /reference/{analyte}`
- `GET /regions/{structure}`
- `GET /nasa/search?q=` (live CKAN, falls back to offline cache)
- `POST /downlink`

## 10. Core rules

- **Baseline**: first 7 sessions. z = (value − median) / (1.4826 × MAD).
- **Status**: |z| > 2 → Watch; |z| > 3 or Watch 3 days in a row → Act; low quality → No data.
- **Triage order**: danger signs → movement/press pattern → bone weighting by mission day → exercises only if safe.
- **Rules, not AI**, for triage, so every result can show its reasons.
- Every screen footer: "Prototype, not a medical device."

## 11. Screens

1. Home — mission day, phase, today's status tiles, "Start daily check"
2. Daily check — face scan → mood/sleep → done
3. Body — 3D model, tap to report
4. Symptom flow — questions → danger signs → movement test → result
5. Why it hurts — card + 3D zoom + NASA evidence chip
6. Exercise — card, live pose + ghost coach, pain before/after
7. Balance test
8. Nutrition & mass
9. NASA Library
10. Crew medical officer view — all crew statuses, alerts, downlink queue

## 12. Team split

| Who | Owns |
| --- | --- |
| Matthew | 3D body + tap-to-zoom + front-end shell |
| Teammate A | Symptom / danger-sign / movement-test rules + why-it-hurts cards |
| Teammate B | MediaPipe workers: face scan, pose coach, balance |
| Teammate C | FastAPI + SQLite + NASA ingest (OSDR, RadLab, data.json) |
| Everyone | Demo video / slides, submission text, credits |

## 13. Timeline (KST)

**Saturday Nov 14**

- 09:40–10:00 — agree on this outline, split roles, set up repo
- Team meeting slot (Sat 10:00–13:00 if booked) — whole team, cameras on, in room 5 min early
- 11:00–12:00 — individual check-in survey
- 10:00–13:45 — 3D model exported + loading; FastAPI skeleton; face-scan worker running
- 14:00–17:00 — Matthew at hagwon (team continues)
- 17:00–18:00 — check-in if possible; tap-to-zoom working
- ~21:00/22:00–late — symptom flow end-to-end with 3D body

**Sunday Nov 15**

- 06:00–12:00 — check-in survey (do it early); exercise coach + why-it-hurts cards
- 12:00–15:00 — balance test, NASA library, radiation panel
- 15:00–17:30 — check-in survey; freeze features; record demo; write submission
- **17:30 — submission-ready**
- 18:00–22:00 — Matthew at hagwon
- 22:00–23:55 — final check and upload. **Submit by 23:55** (official deadline 23:59)

## 14. Demo & submission checklist

- [ ] All members confirmed at the Seoul event and listed on the official team page (no waitlisted members)
- [ ] Team meeting booked by ONE representative (exact team name, team page URL, rep name + NASA email, all members' NASA emails); everyone attends, cameras on, 5 min early
- [ ] 4 of 5 checkpoints (team meeting counts as one) + any mandatory items
- [ ] Project Demo: ONE public link, either up to 7 slides (title slide counts) OR a video of up to 30 s; in English (English subtitles otherwise)
- [ ] Final Project: a separate public link (GitHub repo + live site); open both links while logged out
- [ ] No identifiable name, voice or image of anyone under 18
- [ ] No NASA logo as team/project branding, no implied NASA endorsement, no NASA branding in AI-generated content
- [ ] AI-generated images/video carry a visible watermark; AI-generated code/data acknowledged in README text and metadata
- [ ] Use of SI field: tools selected + where and how each was used
- [ ] Space Agency Data: at least one NASA resource from the challenge's Resources tab (required for Global Awards)
- [ ] References: every dataset, tool, code, text and image with link, which part used it, and its license
- [ ] Our code under an OSI license (MIT or Apache-2.0); no secret keys or personal data in the repo
- [ ] Tick "Agree to Terms" + "Confirm All Work is Original" → Submit for Judging → status reads "Project Submitted for Judging"
- [ ] Re-submit after every edit (only the last submitted version is judged); finish by 23:55

## 15. Submission form fields (Seoul D-Day guide)

Profile icon → My Team → Project → Edit Details. Turn **Lock ON** while editing (a teammate unlocking can overwrite unsaved changes). Save Progress often, but saving is not submitting. Keep the text drafted here as a backup.

| Field | What we put |
| --- | --- |
| 1. High-Level Summary | 50–200 words in English: what we built, how it answers the challenge, why it matters |
| 2. Project Demo | One public link: 7-slide deck or 30 s video |
| 3. Final Project | GitHub repo with README (live link at top, screenshots, run commands, env vars, data setup, unfinished parts) + live site |
| 4. Project Details | Problem, approach and why, what the NASA data represents and how it shaped design/validation, what we tested, limits and next steps |
| 5. Use of SI (AI tools) | Each AI tool and where/how it was used |
| 6. Space Agency Data | OSD-569, OSD-575, RadLab, EDA, NLSP via data.nasa.gov: how each was used and how it inspired the project |
| 7. References | Full list with links and licenses (MediaPipe, Z-Anatomy, React, three.js, FastAPI, NOAA if used…) |

Judges know a 2-day build won't be complete: for unfinished parts, show the blueprint and the reasoning behind the design.

## 16. Team meeting prep (everyone answers individually)

Prepare only for the stage we booked.

- **Idea & design** — Rep: who is it for, and what data and technology will we use? Each member: which part is yours, and how will you build it?
- **Building** — Rep: what have we made so far (show the screen)? Each member: what did you personally build, and what's next?
- Matthew's one-liner: "I'm building the 3D body — the Z-Anatomy model exported to glTF in react-three-fiber — with tap-to-select and zoom to the painful muscle or bone, plus the front-end shell."

## 17. Judges and criteria

- Judges: KASI (space science), SNU Graduate School of Data Science, AWS Aerospace & Satellite Solutions, Yonsei Computer Science.
- Five criteria: **Impact, Creativity, Validity, Relevance, Presentation**.
- Lean on **Validity** (sourced thresholds, quality gating, personal-baseline statistics) and **data use** — this panel is science- and data-heavy.
- Tie-break: team entries beat solo; among teams, more members wins.

## 18. Collaborators and free offers — decision

The guide lists these as sponsors and optional offers, not required data. Nothing says using them earns points, so we only use what helps the product.

| Name | What it is | Decision |
| --- | --- | --- |
| AWS (Aerospace & Satellite) | Cloud, AI, satellite data support | **Optional, natural fit only:** OSDR data is also in a public AWS S3 bucket, so the ingest script can pull from it. No AWS hosting needed (GitHub Pages / Vercel is fine). |
| BizData | Autonomous-operations and big-data company | **Skip** — no public dataset or library offered |
| 모두의연구소 (ModuLabs) | AI learning community and courses | **Skip in product** — learning benefit only |
| 미소정보기술 (MISOINFOTECH) | Multimodal data and AI for healthcare/space | **Skip** — no public library or data offered |
| Global Offers (GoDaddy, Google, Meteomatics, Microsoft, Miro) | Free tools, claimed via Profile → Offers | **Optional:** Miro for team planning if wanted; skip the rest. Any AI tool used must go in Use of SI. |
| Space Agency Partner data | Optional, encouraged | RadLab already combines measurements from NASA, ESA and the German and Italian space agencies — mention this in Space Agency Data. |

## 19. Pitch flow (7 slides)

1. Problem: far from Earth, the crew must spot health changes themselves
2. Space body changes by mission phase
3. Crew Mirror daily check (face scan + mood)
4. Pain → 3D body → movement test → why it hurts → relief exercise
5. Balance test at G-transitions
6. NASA evidence behind every card + works offline
7. Validity, safety rules, next steps

## 20. Sources

- NASA: Astronauts' Spines Under Scrutiny — https://www.nasa.gov/feature/astronauts-spines-under-scrutiny
- NASA: Walk the Line (post-flight balance) — https://www.nasa.gov/?p=268780
- NASA Field Test: tandem walk — https://ntrs.nasa.gov/api/citations/20160013636/downloads/20160013636.pdf
- Paraspinal muscle study in ISS crew — https://pmc.ncbi.nlm.nih.gov/articles/PMC5588025
- Body mass changes during long-duration spaceflight — https://www.ncbi.nlm.nih.gov/pubmed/25197887
- NASA space nutrition and bone — https://ntrs.nasa.gov/citations/20080026254
- NASA OSDR overview — https://ntrs.nasa.gov/citations/20230015800
- NASA Life Sciences Portal — https://data.nasa.gov/dataset/nasa-life-sciences-portal-nlsp
- Z-Anatomy — https://github.com/Z-Anatomy/Models-of-human-anatomy
- MediaPipe tasks-vision — https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/README.md
