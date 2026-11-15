# Crew Mirror: 30-second ad plan (v2)

**The ad is built and rendered.** Open `ad/index.html` in Chrome to play it live (it works straight from disk), or use the finished video `ad/crew-mirror-ad.mp4` (1920×1080, 30 fps, 30 s, no sound).

**Concept:** it opens like real footage from orbit, then cuts to one phone that shows the real app. The camera moves the phone left and right between features, and a Mac-style cursor taps through it. There are **no people** anywhere: the face scan is MediaPipe's generic canonical face mesh, drawn exactly like the app draws it (478 teal 2 px dots on `#050816`).

**Goal:** in 30 seconds, a judge should know who it's for (an astronaut far from Earth), what it does (a two-minute check that compares you with your own normal), and why astronauts will keep using it (a pet that grows when they show up).

---

## Timeline (matches `ad/index.html`)

Retimed so every feature gets the same unrushed share: a 3.5 s opening, then **13 features of 1.9 s each** (whip transition included), then a 1.8 s end card. The phone alternates right and left; each feature has one caption on the other side. Every app clip is at least 2.2 s of real interaction at real speed (no slow motion, freeze frames or loops). A small "Made with AI assistance (Claude Code)" label sits in the bottom-right corner for all 30 s (Space Apps rule for AI-generated video).

| Time | Feature | Picture | Caption |
|---|---|---|---|
| 0:00.0–0:03.5 | Opening | three.js: sunlit Earth limb, the Moon slides past the lens, quick push in to Mars. Mono HUD types **MARS SIGNAL DELAY · UP TO 22 MIN**. | **On the way to Mars, help is far away.** |
| 0:03.5–0:05.4 | 1. Today | The space shot dims; the phone rises on the right with the real Today screen. The cursor taps **Start today's check · 2 min**. | **No doctor on board.** So check in every day. |
| 0:05.4–0:07.3 | 2. Face scan | Whip left. Daily check while scanning: live 478-point face mesh (head turn, a blink, breathing), countdown from 60s. Slow push in. | **Two minutes. Just the camera.** Video never leaves the device. |
| 0:07.3–0:09.2 | 3. Result | Whip right. "How you're doing": **WATCH · You slept less than usual**. The cursor taps **How we know** and the reason opens. | **Compared with you.** Not an average. |
| 0:09.2–0:11.1 | 4. Today scroll | Whip left. Today scrolls slowly from the top to the face scan trends. | **Your day, at a glance.** |
| 0:11.1–0:13.0 | 5. Plan | Whip right. Plan › Exercise: "Resistive session on ARED" gets its tick. | **Exercise, ticked off.** |
| 0:13.0–0:14.9 | 6. Food | Whip left. Food today: three foods added, nutrient bars grow. | **Food that fills the gaps.** |
| 0:14.9–0:16.8 | 7. 3D body | Whip right. 3D body, Muscles layer; the cursor drags it round slowly. | **Your body, in 3D.** |
| 0:16.8–0:18.7 | 8. Space weather | Whip left. Tap the **Space weather: Quiet** pill; Today scrolls to the solar radiation storm card. | **Radiation storms, watched.** |
| 0:18.7–0:20.6 | 9. Calendar | Whip right. Calendar: tap the 18th; the EVA shows below. | **Every day of the mission.** |
| 0:20.6–0:22.5 | 10. Report pain | Whip left. **Yes** to chest pain → **Continue → Act now** → **Act now: contact the crew medical officer** (no exercises). | **Danger signs come first.** Act now: crew medical officer. |
| 0:22.5–0:24.4 | 11. Reminders | Whip right. Settings › Reminders: the daily reminder switch turns on. | **Reminders at your time.** |
| 0:24.4–0:26.3 | 12. Notification | Whip left. Today dims; an iOS-style banner slides in: **You haven't done today's check** / "Two minutes now keeps your normal accurate." | **A nudge each morning.** No signal needed. |
| 0:26.3–0:28.2 | 13. Pet | Whip right, pushed in on the pet card. The cursor taps the egg three times; it wobbles and hatches (flash, ring, sparkles) into the Hatchling. | **It grows with you.** Show up daily. |
| 0:28.2–0:30.0 | End card | The phone flips to the app icon and settles right. | **Crew Mirror** · Your health, measured against you. · Team SYS-ASTRO · NASA Space Apps Seoul 2026 · *Prototype, not a medical device.* |

Optional voice-over (about 60 words): "On the way to Mars, help is far away. There's no doctor on board. Crew Mirror is a two-minute check with just the camera. It compares you with your own normal, then tells you what to do today, and why. Danger signs come first. Show up every day, and your crew pet grows with you. Crew Mirror. Your health, measured against you."

---

## How it is made

- **Space opening:** three.js (`ad/vendor/three.min.js`, bundled from the app's own `three` package, no CDN) with real public-domain maps in `ad/textures/`: NASA Blue Marble Next Generation (Earth), a cloud layer from NASA SVS 3615, the NASA SVS CGI Moon Kit (LRO), and the USGS/NASA Viking MDIM2.1 Mars mosaic. Custom shaders do the atmosphere rim, ocean glint, terminator and post effects (lens flare, grain, vignette, chromatic aberration). Everything is a function of the timeline time, so every frame renders the same way every time.
- **Real app clips:** `ad/capture/capture.py` drives the running app (`npm run dev`) in Playwright at 402×856 CSS px, 2× scale, dark mode, with real taps, scrolls and drags. CSS animations are stepped 33 ms per frame, so the clips are smooth. Clips are H.264 in `ad/clips/`; stills are in `ad/shots/`. Tap positions are saved in `ad/clips/meta.js`, and the ad's cursor uses them.
- **Data in the captures:** `ad/capture/fixture.js` writes a 21-day history for one astronaut (call sign MS3) into the capture browser's IndexedDB before the app loads. It never ships in the app. The pet shots use 0 and 1 check days (egg and Hatchling).
- **Face mesh:** `ad/capture/make_face_mesh.mjs` takes the 468 vertices of MediaPipe's canonical face model (Apache-2.0) plus 10 iris points and the connection lists from `@mediapipe/tasks-vision`. The ad draws only the points, like `web/src/vision/camera.ts` `drawFace` (the app draws no lines).
- **Rendering:** `window.__seek(ms)` pauses every animation at that time, renders the WebGL frame, seeks each visible video and waits for `seeked`. The recorder steps all 900 frames and pipes them to ffmpeg (libx264). Open `ad/index.html?rec=1` to hide the Replay button.

## How to edit or re-render it

- **Text or timing:** edit `ad/index.html`. The 13 feature slots, their phone side and captions are the `F` list (`OPEN`, `D` set the opening length and slot length); phone poses per feature are `POSE`, built into the `RK` keyframes; the space camera is `CAMK`.
- **Re-capture a clip:** `python ad/capture/capture.py m_plan` (or `today`, `check`, `pet`, `m_food`, …) with the app running on port 5173.
- **Add sound:** put the MP4 into iMovie, CapCut or DaVinci Resolve and add a royalty-free track; credit it in the README References.

## Rules check
- [x] No NASA logo, and nothing suggests NASA made or approved the app. NASA/USGS imagery is credited in the README as image sources only.
- [x] No people: no faces, names or voices. The face is a generic mesh, not a real person.
- [x] No on-screen text says demo, sample, test or made up.
- [x] "Prototype, not a medical device" on the end card.
- [x] "Pattern", never "diagnosis" (the pain result screen says "This is a pattern, not a diagnosis").
- [ ] If you add music, credit it in the README References.
- [x] AI use is recorded in `docs/AI_USE.md`.
- [x] Visible AI label on every frame: "Made with AI assistance (Claude Code)", bottom right.
