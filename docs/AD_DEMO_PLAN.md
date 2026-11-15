# Crew Mirror: 30-second ad plan

**The ad is built and rendered.** Open `ad/index.html` in Chrome to play it live, or use the finished video `ad/crew-mirror-ad.mp4` (1920×1080, 30 fps, no sound).

**Concept:** one phone floating in space. The camera glides and zooms into each screen, and a Mac-style cursor taps through the app. There are **no people** anywhere: the face scan shows synthetic landmark dots, never a real face. Dark, minimal, product-launch style.

**Goal:** in 30 seconds, a judge should know who it's for (an astronaut far from Earth), what it does (a two-minute check that compares you with your own normal), and why astronauts will keep using it (a pet that grows when they show up).

---

## Timeline (matches `ad/index.html`)

| Time | Picture | On-screen text | Voice-over (optional, word for word) |
|---|---|---|---|
| 0:00–0:04 | Earth and Mars. A dot travels along the path while a counter runs to "20 min". | **On the way to Mars, help is far away.** | "On the way to Mars, a message to Earth takes up to twenty minutes." |
| 0:04–0:08 | The phone rises in 3D with the Crew Mirror logo. The cursor glides in and clicks **Start today's check**. | **No doctor on board.** So who notices when your body starts to change? | "There's no doctor on board. So who notices when your body changes?" |
| 0:08–0:13 | Zoom into the daily check: face dots pop in, the scan ring fills, the breathing line moves, and heart rate counts to 61 bpm. | **Two minutes. Just the camera.** Video never leaves the device. | "Crew Mirror. A two-minute check with just the camera." |
| 0:13–0:17 | Result: "You slept less than usual". The line drops below the shaded normal band. Two chips fly out of the phone. | **Compared with you. Not an average.** | "It compares you with your own normal, so small changes show up early." |
| 0:17–0:21 | The real Plan screen. The cursor ticks the first exercise, and a toast says "Exercise done. Your pet is happy." | **What to do today, and why.** | "Then it tells you what to do today, and why." |
| 0:21–0:25 | Close zoom on the pet. The cursor taps the egg three times, it hatches into the Cadet with sparkles, and the streak goes 6 → 7. | **Show up daily. It grows with you.** | "Show up every day, and your crew pet grows with you." |
| 0:25–0:28 | Quick cuts: the 3D muscle body (cursor click), the radiation storm card, and the phone in airplane mode showing "No signal. Everything still works." | **Pain. Radiation. Recovery.** All on the device. No internet needed. | "Pain, radiation, recovery. All offline." |
| 0:28–0:30 | The phone turns to the logo. The title appears. | **Crew Mirror.** Your health, measured against you. · Team SYS-ASTRO · NASA Space Apps Seoul 2026 · *Prototype, not a medical device.* | "Crew Mirror. Your health, measured against you." |

The voice-over is about 70 words. The captions carry the story on their own, so the video also works muted.

---

## How to edit or re-render it

- **Change text or timing:** edit `ad/index.html`. Every animation sits on one 30-second timeline, set by `tl(element, [[seconds, {css}], ...])`. Captions use `show('c3', start, end)`, and the phone camera moves are the `tl('rig', ...)` list.
- **Swap a screen:** replace an image in `ad/shots/`. These are real app screens at 402 px wide and 2× scale, captured with Playwright from the sample crew in dark mode.
- **Re-render the MP4:** the recorder steps through all 900 frames with `window.__seek(ms)` and pipes them to ffmpeg, so there are no dropped frames. Open `ad/index.html?rec=1` to hide the Replay button.
- **Add sound:** put the MP4 into iMovie, CapCut or DaVinci Resolve. Add a royalty-free track (YouTube Audio Library or Pixabay Music) and, if you like, the voice-over above. Credit the music in the README References.
- **Figma:** the Figma connector isn't authorised in this session. Once it's connected (run `/mcp` in Claude Code), the same scenes can be rebuilt as Figma frames with Smart Animate.

## Rules check
- [x] No NASA logo, and nothing suggests NASA made or approved the app.
- [x] No people: no faces, names or voices. The face dots are generated, not from a real person.
- [x] "Prototype, not a medical device" on the end card.
- [x] "Pattern", never "diagnosis".
- [ ] If you add music or stock footage, credit it in the README References.
- [x] AI use is recorded in `docs/AI_USE.md`.
