# Crew Mirror — feature deep dive (Nov 14, 2026)

One section per feature: what it does, how it works, how it was checked, what was wrong and
fixed in this pass, and what is still limited. "Tested" means automated tests (`npm test`,
`pytest`) or a scripted run in the browser.

---

## 1. Daily face scan (heart rate, breathing, fatigue, fluid shift)

**What:** 30 s or 60 s in front of the camera. MediaPipe Face Landmarker runs in a Web Worker.
Only landmark points are drawn, on a dark canvas, and only numbers are kept.

| Measure | How | Quality gate → "No data" |
| --- | --- | --- |
| Heart rate (estimate) | rPPG, POS method (Wang 2017) on forehead + cheek colour; spectral peak 42–180 bpm | <10 s, face <85% of frames, light outside 50–230, head motion, weak peak (<0.30 of in-band power) |
| **Breathing rate (estimate) — new** | Head-motion and skin-colour signals, spectral peak 6–30 /min; the cleaner one wins | <24 s (needs the 60 s scan), unclear rhythm (<0.35) |
| Blink rate, PERCLOS | Eye-blink blendshapes, hysteresis 0.5/0.3, closed > 0.7 | Face presence |
| Face-width ratio | Cheek width ÷ inter-pupil distance (scale-free) | **New: only frames facing the camera (head-turn < 6% of face width)** |

**Tested:** the synthetic 72 bpm pulse is recovered; noise and short clips → No data. The synthetic 14 /min
breathing signal is recovered; noise → No data. In the browser, a fake camera with no face gives every
measure as No data.
**Fixed this pass:** breathing rate added; a head-turn (yaw) gate added for face width.
**Limits:** not validated against reference devices. The thresholds are engineering choices. A real
webcam test on a person is still needed (the preview browser blocks the camera).

## 2. Personal-baseline status engine

**What:** baseline = first 7 good **days**. z = (value − median) / max(1.4826·MAD, floor).
|z| > 2 → Watch, |z| > 3 or Watch 3 days in a row → Act, failed quality → No data.
**Fixed this pass:** values are now collapsed to one per calendar day, in both the browser and the server.
Before, 7 checks in one morning made a fake baseline, and "3 days in a row" really meant "3 sessions".
**Tested:** shared JSON cases run by both vitest and pytest, plus a per-day collapse test.

## 3. Danger signs and symptom triage

**What:** 5 danger signs are always asked first. Then nerve → weakness → possible fracture → severe
pain → patterns. Bone-loss weighting lowers the pain level that triggers a CMO referral at
weight-bearing sites (~1 %/month in microgravity).
**Fixed this pass:** added the regions arm, thigh, lower leg and chest/abdomen. Chest/abdomen always
goes to the medical officer and gets no self-tests. Thigh and shin count as weight-bearing.
Shared cases went from 15 to 19.
**Limits:** patterns are educational. The thresholds are not clinically validated.

## 4. 3D body (Blender → web) — new

**Pipeline:** `ingest/blender/export_body.py` runs headless Blender (scripts in the .blend disabled) on
the Z-Anatomy atlas. It does these steps:
- picks real structures (bones, muscles, skin regions, major nerves, discs and ligaments),
- skips helper objects and labels,
- **leaves out sex-specific anatomy** (genital region, pubic hair, breast/nipple, anal region),
- applies modifiers, bakes transforms and decimates to a triangle budget (skeleton 320k, muscles 420k),
- tags each node with its name, side and body region,
- writes Draco-compressed `skeleton/muscles/skin/nerves/joints.glb` plus a manifest.

**Viewer:**
- Layers can be toggled, and an x-ray slider fades the muscles.
- Front/back/left/right views.
- Tap any structure and the camera flies to it.
- **Peel-through:** lists every structure under your finger, from skin to bone.
- **Search** over all structures by name.
- Regions with problems are highlighted, and a recent pain report highlights the exact structure.

**Fixed this pass:**
- Names were mis-mapped. "Long **head** of biceps femoris" went to the head, and "fem**oral**" matched "oral".
- Upper vertebrae fell into the head because of their height.
- Back muscles all went to the upper back.
- A middle-side pain didn't highlight both sides.
- Back regions were viewed from the front.
- The loading label caused a React unmount race (drei `<Html>`).

**Limits:**
- Region mapping uses keywords plus height, and some edge structures may sit in a neighbouring region.
- The model is based on a single adult body.

## 5. Point to pain on camera — new

**What:** Pose + Hand Landmarker run together. The index fingertip is matched to the nearest body
segment of your own skeleton in the same frame. The pointing arm itself is ignored, and you hold for
1.2 s to confirm. Turning around switches the trunk to back regions.
**Tested:** 6 synthetic-pose tests (knee and thigh by side, own-arm exclusion, back regions, nothing
touched, hold logic).
**Limits:** pose fingers are coarse, so the hand model is used for the fingertip. The back is easier
to tap on the 3D model.

## 6. "Where does it come from?" — new

**What:** for 11 regions, 3–4 candidate sources each: muscle, joint, disc, nerve root (referred) or
bone. Each source has yes/no questions with fixed weights. Candidates light up on the 3D body: violet
for sources, yellow for nerve paths, red for where it hurts. Safety questions (tingling, bony spot,
swelling, can't bear weight) feed the triage engine, so they still route to the medical officer.
**Checked:** every source's 3D pattern matches real model structures (script check). In the browser,
back pain going below the knee lights the sciatic nerve and the L4–S1 discs.

## 7. Balance test — fixed

You can't do standing balance or sit-to-stand while floating, because there is no "up". The tests
are now **disabled in transit**, with an explanation. NASA tests balance pre-flight (baseline) and right
after landing, and the app now does the same. The Plan asks for a balance test in the Landing, Surface
and Return phases.

## 8. Exercise coach — new

**What:** squat, lunge, arm raise (shoulder range), calf raise and sit-to-stand. It uses **MediaPipe
3D world landmarks** (metres, hip-centred), so joint angles don't depend on the camera. It counts reps
with fixed thresholds and gives form cues: knees caving in, chest dropping, too shallow, uneven, too fast.
It also records pain before/after (a rise of 2+ points means stop and report), records the
shoulder-range angle where pain starts, and exports the tracked 3D joints as JSON/CSV for Blender or
spreadsheets. Exercises that need load are marked in flight (harness/ARED only).
**Tested:** angle maths, clean-rep counting, fault detection, range recording.

## 9. Plan: exercise and food — new

- **What to do today:** fixed rules turn Act/Watch statuses, pain reports and phase into actions, each
  with its **because**. For example, fatigue → protect sleep, low mass → eat more, landing → balance test.
- **Exercise plan by phase:** the transit plan is about 2 h a day of ARED + treadmill/cycle. Loading is
  skipped for areas under medical review, and intensity is reduced on Act-level fatigue days.
- **Food:** targets come from body mass (defaults the crew nutritionist can edit: 35 kcal/kg, protein
  1.2 g/kg, calcium 1000 mg, vitamin D 20 µg, sodium ≤ 2300 mg, potassium 3500 mg, fluid 2.5 L). There's
  a pantry log and "close today's gap" suggestions. Food values are approximate.

## 10. Calendar — new

Month view: daily checks coloured by that day's status, pain reports, balance tests, workouts and
mission events (EVA, medical conference, arrival). There's a check-in streak and you can add your own events.

## 11. Accounts and cloud sync (Supabase) — new, connected

Email/password sign-in, with an offline mode that works without an account. Only derived numbers sync.
Project `crew-mirror` (Seoul). **Row-level security, tested with throwaway users:**
- each user sees only their own rows;
- a medical officer sees only their own mission's crew, and can't edit their data;
- self-promotion and changing your mission code → permission denied;
- writing as another user → blocked.

**Fixed while connecting:**
- The medical-officer flag could be self-assigned at sign-up. It is now request-only and admin-approved.
- A column-level revoke didn't override Supabase's table-level UPDATE grant.
- The RLS helper was callable through the public API. It now lives in a private schema.

Security advisors: none.

## 12. Settings — new

Profile, mission phase, nutrition targets, scan length, theme, account, habitat-server status, data
export/reset, and privacy.

## Removed

The sidebar "Day 96 · ACT · days floating" card was removed, as requested.
