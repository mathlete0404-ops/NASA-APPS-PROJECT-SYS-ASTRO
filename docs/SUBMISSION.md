# Submission draft — paste into the Space Apps project page

Profile icon → My Team → Project → Edit Details. Turn **Lock ON**, **Save Progress** often, then **Submit for Judging** and check that the status reads "Project Submitted for Judging". Re-submit after every edit; finish by **23:55 KST, Nov 15**.

Links go to the team's **existing** GitHub repo ("NASA Space App SYS-ASTRO"). Do not create a new one.

---

## 1. High-Level Summary (50–200 words)

Crew Mirror is an offline, camera-based daily health check for astronauts on long missions. In a few minutes in front of a laptop or tablet, on-device computer vision (MediaPipe, in a Web Worker) estimates heart rate, blink rate, eye closure, facial fluid shift and balance. A short check-in adds mood and sleep. Every value is compared with the astronaut's **own** baseline (first 7 sessions, robust z-scores), not a population average, giving Usual / Watch / Act / No data. A symptom flow always screens danger signs first, then uses deterministic rules (not AI) to find a pattern, explain why it hurts in space, and say what to do: relief exercises, or contact the crew medical officer. Fracture risk is weighted by estimated bone loss in microgravity. Video never leaves the device, and everything works without Earth. NASA's Inspiration4 blood data shows why: 55 of 60 post-flight changes that left a crew member's own range still looked "normal" on population ranges. (≈160 words)

## 2. Project Demo

_One public link: ≤ 7 slides (title counts) or ≤ 30 s video, in English. Test it while logged out._

Suggested 7 slides: (1) title, team, challenge → (2) problem: far from Earth, the crew must spot change themselves → (3) solution: daily check + key features → (4) app screens (landing, Today, symptom result, balance verdict, CMO board) → (5) NASA data: Inspiration4 personal-vs-population chart → (6) how it works: rules, baseline maths, privacy, offline → (7) impact, next steps, references.

## 3. Final Project

_Public link to the existing team GitHub repo (README has run steps, screenshots, limitations) + live static site._

## 4. Project Details

**Problem.** On a Mars mission, a round-trip to Earth takes up to ~48 minutes. Crews need to notice slow changes (fatigue, fluid shift, deconditioning, balance after landing, back pain) themselves, and know when something is dangerous.

**Hypothesis / approach.** Population "normal" ranges hide personal change. A cheap, daily, camera-only check compared with each person's own baseline can catch it, as long as it is honest about data quality and never improvises on safety.

**How it works.**
- *Measure*: MediaPipe Face/Pose Landmarker run in a Web Worker in the browser. rPPG heart-rate estimate (POS method, quality-gated), blink rate, PERCLOS, face-width ÷ inter-pupil ratio, hip sway as % of shoulder width, 5× sit-to-stand. Bad light, movement or a hidden face → "No data".
- *Compare*: baseline = first 7 good sessions; z = (x − median) / max(1.4826·MAD, floor); |z| > 2 Watch, > 3 or Watch ×3 → Act.
- *Triage*: danger signs first (any yes → Act now, contact CMO, no exercises). Then nerve → weakness → possible fracture → severe pain → pattern (muscle strain, tendon irritation, tightness, joint irritation). The referral threshold for pain at weight-bearing sites drops with estimated bone loss (~1 %/month in microgravity).
- *Act*: "why does it hurt?" cards (space effect → your test → what helps, each with evidence links), relief exercises with stop rules, crew medical officer board, delayed downlink with Mars light-time.
- *Architecture*: React + TypeScript installable web app (IndexedDB, service worker, bundled models) plus a FastAPI + SQLite "habitat server". The same rules run in both, tested against shared JSON cases (27 web tests, 24 server tests).

**What the NASA data represents and how it shaped the design.** OSD-569/575 hold clinical blood counts and metabolic panels for the 4 Inspiration4 crew at 3 pre-flight and 4 post-flight time points. For each crew member and analyte we took the pre-flight values as a personal range and compared the day-after-landing value. 60 of 137 values left the personal range; 55 of those were still inside the lab's population range, and only 5 values were flagged by the population range at all. This drove the core design choice of a personal baseline. Because only 3 pre-flight points exist, some exits are normal variation, so the app uses 7 baseline sessions, robust statistics and a minimum-change floor.

**What we tested.** Shared rule cases in both engines; rPPG on synthetic pulses (recovers 72 bpm; returns No data on noise and on short clips); end-to-end scan with a fake camera stream (no face → all "No data"); MediaPipe workers loading on GPU; full symptom flow in the browser; layout at desktop and 375 px phone width, light and dark.

**Limitations & next steps.** 3D Z-Anatomy body (2D map for now); camera-measured range of motion with gesture confirm; ghost exercise coach; validation of camera measures against reference devices; nutrition log; RadLab ingest.

**Tools.** TypeScript, React, Vite, MediaPipe Tasks Vision, IndexedDB, Python, FastAPI, SQLite, Vitest, pytest. Runs on any laptop or tablet with a webcam.

## 5. Use of SI (AI tools)

Claude Code (Anthropic, model Claude Opus 5.5) was used as a coding assistant: ingest scripts, rule engines and tests, the habitat server, web app screens and the landing/UI styling, plus README and submission drafts. Team members chose the features, safety rules and thresholds, and reviewed and tested the output. A line-by-line log is in `docs/AI_USE.md`; generated code is also acknowledged in the README and in the HTML `generator` meta tag. No AI-generated images, video or audio are used, and no NASA branding appears in any generated content.

## 6. Space Agency Data

- **NASA OSDR OSD-569 & OSD-575** (Inspiration4 CBC and CMP): downloaded by `ingest/osdr_inspiration4.py` and analysed for personal-vs-population change. Shown on the landing page and the Evidence page. This is the evidence behind the personal-baseline design.
- **data.nasa.gov catalog** (CKAN API): an offline NASA Evidence Library on board, with live search when the habitat server has a link.
- **RadLab Portal** and **OSDR Environmental Data App**: evidence links on the radiation panel and the headache/CO₂ card. RadLab combines measurements from NASA, ESA and the German and Italian space agencies.
- **NASA Life Sciences Portal**, plus NASA articles on spine lengthening, post-flight balance (Field Test) and nutrition/bone: content for the "why it hurts" cards.

## 7. References

See README → References (every dataset, model, library, font and paper, with link, where it is used and its license).
