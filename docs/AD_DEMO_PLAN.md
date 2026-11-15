# Crew Mirror: 30-second ad plan (v2)

**The ad is built and rendered.** Open `ad/index.html` in Chrome to play it live (it works straight from disk), or use the finished video `ad/crew-mirror-ad.mp4` (1920×1080, 30 fps, 30 s, no sound).

**Concept:** it opens like real footage from orbit, then cuts to one phone that shows the real app. The camera moves the phone left and right between features, and a Mac-style cursor taps through it. There are **no people** anywhere: the face scan is MediaPipe's generic canonical face mesh, drawn exactly like the app draws it (478 teal 2 px dots on `#050816`).

**Goal:** in 30 seconds, a judge should know who it's for (an astronaut far from Earth), what it does (a two-minute check that compares you with your own normal), and why astronauts will keep using it (a pet that grows when they show up).

---

## Timeline (matches `ad/index.html`)

| Time | Picture | On-screen text |
|---|---|---|
| 0:00–0:02.4 | three.js: sunlit Earth limb over Arabia and the Red Sea, thin blue atmosphere, night side dark, sun just off frame (anamorphic streak), slow drift along the limb. Film grain, vignette, slight chromatic aberration and shake. | Mono HUD types on: **SIGNAL DELAY · EARTH ⇄ MARS · UP TO 22 MIN** · "One way. Each message, each answer." |
| 0:02.4–0:04.1 | The camera pans up; the Moon rises over the limb and slides past the lens. | **On the way to Mars, help is far away.** (from 0:02.9) |
| 0:04.1–0:05.1 | Push in on a small Mars rising above Earth's orange terminator. | (headline holds) |
| 0:05.1–0:07.8 | The space shot dims to a backdrop. The phone rises on the right with the real Today screen. The cursor taps **Start today's check · 2 min**. | **No doctor on board.** So who notices when your body starts to change? |
| 0:07.8–0:11.6 | Whip pan left. Real Daily check screen while scanning: live 478-point face mesh (head turns, two blinks, breathing), countdown 60s → 57s. Slow push in. | **Two minutes. Just the camera.** Only the dots are drawn. Video never leaves the device. |
| 0:11.6–0:14.4 | Swing right. Today's "How you're doing" card: **WATCH · You slept less than usual (5.8 h; usually about 7 h).** The cursor taps **How we know** and the z-score reason opens. | **Compared with you. Not an average.** Small changes show up early. |
| 0:14.4–0:15.4 | Montage clip 1 (phone left): Today scrolls. | Today · **Your day, at a glance.** |
| 0:15.4–0:16.5 | Whip pan right. Plan: "Resistive session on ARED" gets its tick, 1/4 done. | Exercise · **Exercise, ticked off.** |
| 0:16.5–0:17.6 | Scale punch. Food: three foods added, nutrient bars grow. | Food · **Food that fills the gaps.** |
| 0:17.6–0:18.7 | Phone flip, left. 3D body, Muscles layer, cursor drags it round. | 3D body · **Your body, in 3D.** |
| 0:18.7–0:19.7 | Whip right. Tap the **Space weather: Quiet** pill, scroll to the solar radiation storm card (live NOAA reading). | Space weather · **Radiation storms, watched.** |
| 0:19.7–0:20.6 | Scale punch. Calendar: tap the 18th, the EVA shows. | Calendar · **Every day of the mission.** |
| 0:20.6–0:21.6 | Phone flip, left. Report pain: **Yes** to chest pain → **Act now: contact the crew medical officer** (no exercises). | Pain check · **Danger signs come first.** |
| 0:21.6–0:22.4 | Whip right. Settings › Reminders: the daily reminder switch turns on. | Reminders · **Reminders at your time.** |
| 0:22.4–0:24.0 | The Today screen dims; an iOS-style banner slides in: app icon, **You haven't done today's check** / "Two minutes now keeps your normal accurate.", "now". | **A nudge each morning.** Set on the device. No signal needed. |
| 0:24.0–0:27.7 | Push in to the real pet card. The cursor taps the egg three times, it wobbles and hatches (flash, ring, sparkles) into the Hatchling, then grows to the Cadet (7 check days). | **Show up daily. It grows with you.** |
| 0:27.7–0:30.0 | Phone flips to the app icon and settles right. | **Crew Mirror** · Your health, measured against you. · Team SYS-ASTRO · NASA Space Apps Seoul 2026 · *Prototype, not a medical device.* |

Optional voice-over (about 60 words): "On the way to Mars, help is far away. There's no doctor on board. Crew Mirror is a two-minute check with just the camera. It compares you with your own normal, then tells you what to do today, and why. Danger signs come first. Show up every day, and your crew pet grows with you. Crew Mirror. Your health, measured against you."

---

## How it is made

- **Space opening:** three.js (`ad/vendor/three.min.js`, bundled from the app's own `three` package, no CDN) with real public-domain maps in `ad/textures/`: NASA Blue Marble Next Generation (Earth), a cloud layer from NASA SVS 3615, the NASA SVS CGI Moon Kit (LRO), and the USGS/NASA Viking MDIM2.1 Mars mosaic. Custom shaders do the atmosphere rim, ocean glint, terminator and post effects (lens flare, grain, vignette, chromatic aberration). Everything is a function of the timeline time, so every frame renders the same way every time.
- **Real app clips:** `ad/capture/capture.py` drives the running app (`npm run dev`) in Playwright at 402×856 CSS px, 2× scale, dark mode, with real taps, scrolls and drags. CSS animations are stepped 33 ms per frame, so the clips are smooth. Clips are H.264 in `ad/clips/`; stills are in `ad/shots/`. Tap positions are saved in `ad/clips/meta.js`, and the ad's cursor uses them.
- **Data in the captures:** `ad/capture/fixture.js` writes a 21-day history for one astronaut (call sign MS3) into the capture browser's IndexedDB before the app loads. It never ships in the app. The pet shots use 0, 1 and 7 check days.
- **Face mesh:** `ad/capture/make_face_mesh.mjs` takes the 468 vertices of MediaPipe's canonical face model (Apache-2.0) plus 10 iris points and the connection lists from `@mediapipe/tasks-vision`. The ad draws only the points, like `web/src/vision/camera.ts` `drawFace` (the app draws no lines).
- **Rendering:** `window.__seek(ms)` pauses every animation at that time, renders the WebGL frame, seeks each visible video and waits for `seeked`. The recorder steps all 900 frames and pipes them to ffmpeg (libx264). Open `ad/index.html?rec=1` to hide the Replay button.

## How to edit or re-render it

- **Text or timing:** edit `ad/index.html`. Captions use `show('c3', start, end)`; montage clips, captions and transitions are the `M` list; phone moves are the `RK` keyframes; the space camera is `CAMK`.
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
