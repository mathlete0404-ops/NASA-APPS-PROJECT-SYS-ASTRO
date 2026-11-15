# Crew Mirror: 30-second ad plan (v2)

**The ad is built and rendered.** Open `ad/index.html` in Chrome to play it live (it works straight from disk), or use the finished video `ad/crew-mirror-ad.mp4` (1920×1080, 30 fps, 30 s, with an original soundtrack).

**Concept:** it opens with the team name and real-looking footage from orbit with mission telemetry, then the app title, then cuts to one phone that shows the real app. The camera moves the phone left and right between features, and a Mac-style cursor taps through it. There are **no people** anywhere: the face scan is MediaPipe's generic canonical face mesh, drawn exactly like the app draws it (478 teal 2 px dots on `#050816`).

**Goal:** in 30 seconds, a judge should know who it's for (an astronaut far from Earth), what it does (a two-minute check that compares you with your own normal), and why astronauts will keep using it (a pet that grows when they show up).

---

## Timeline (matches `ad/index.html`)

A 5.8 s opening (team card, orbit with mission telemetry, title card), then **13 features of equal length (about 1.74 s each)**, then a 1.6 s end card. The phone alternates right and left; each feature has one caption on the other side. A small "Made with AI assistance (Claude Code)" label sits in the bottom-right corner for all 30 s (Space Apps rule for AI-generated video).

| Time | Feature | Picture | Caption | Sound |
|---|---|---|---|---|
| 0:00.0–0:01.5 | Team card | Black. **TEAM SYS-ASTRO · presents** in wide mono type. | — | Radio "beep" (Quindar tone, as on Apollo-era air-to-ground calls), soft static, the engine rumble starts |
| 0:01.5–0:04.5 | Orbit | Sunlit Earth limb, the Moon slides past the lens, push towards Mars. Mission telemetry ticks top left: mission elapsed time, range to Earth, one-way signal delay. | **EN ROUTE TO MARS** · Help is **22 light-minutes** away. | Deep engine rumble and sub, cabin fan and hum, a slow doppler whoosh as the Moon passes, a riser |
| 0:04.5–0:05.8 | Title | App icon and **Crew Mirror**, "A two-minute daily health check for astronauts.", **TEAM SYS-ASTRO**. | — | A breath of silence, then a deep cinematic hit with a long tail; a wide chord leads into the beat |
| 0:05.8–0:28.4 | 13 features | Today → face scan → result → Today scroll → exercise tick → **package scan** → 3D body → space weather → calendar → danger signs → reminders → notification → pet hatch. | One caption each (see `F` in `ad/index.html`) | 126 bpm synth groove, one bar per feature; whooshes on transitions, clicks on taps, ping on the notification, chime on the hatch |
| 0:28.4–0:30.0 | End card | The phone flips to the app icon. | **Crew Mirror** · Your health, measured against you. · Team SYS-ASTRO · NASA Space Apps Seoul 2026 · *Prototype, not a medical device.* | Bell and a resolving chord |

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
- **Sound:** `ad/capture/make_sound.py` synthesises an original soundtrack from scratch (no samples): a 126 bpm synth bed whose bars line up with each 1.9 s feature, plus whooshes on transitions, clicks on cursor taps, a notification ping, a hatch chime and an end-card bell. Cue times come from `window.__SFX` in `ad/index.html`. Output: `ad/audio/soundtrack.m4a` (played by the **Sound on** button on the live page) and muxed into the MP4.

## Rules check
- [x] No NASA logo, and nothing suggests NASA made or approved the app. NASA/USGS imagery is credited in the README as image sources only.
- [x] No people: no faces, names or voices. The face is a generic mesh, not a real person.
- [x] No on-screen text says demo, sample, test or made up.
- [x] "Prototype, not a medical device" on the end card.
- [x] "Pattern", never "diagnosis" (the pain result screen says "This is a pattern, not a diagnosis").
- [x] Music and sound effects are original (synthesised in `ad/capture/make_sound.py`), so there is nothing to license.
- [x] AI use is recorded in `docs/AI_USE.md`.
- [x] Visible AI label on every frame: "Made with AI assistance (Claude Code)", bottom right.
