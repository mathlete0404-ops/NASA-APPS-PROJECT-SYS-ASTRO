# 00 — Scope

**Audited:** the Crew Mirror web app, local working copy (uncommitted polish pass of 2026-11-15) at
`http://localhost:5173`, source in `web/src/`. Viewed at a 1366×860 desktop size, light and dark, as a new user (MS3) and with
the sample crew (PLT, which has Act results).

Screens in scope: first-open setup (`Welcome.tsx`), app shell + sidebar (`App.tsx`), Today, Daily check, Plan,
Calendar, 3D body, Report pain, Exercise coach, Balance, Settings. Out of scope: rule engines and the server (logic,
not design), the Supabase login screen (owned by a teammate), NASA evidence and Medical officer (looked at but not scored separately).

**Primary user:** an astronaut on a long mission (also used before launch and after landing), often alone, often
offline, tired, and not a clinician.

**Primary task:** do the 2-minute daily check and know what to do today. **Secondary task:** when something
hurts, say where, and get a safe next step.

**Constraints:** NASA Space Apps Seoul 2026, submission due 2026-11-15 23:55 KST. React + Vite + TypeScript, no UI
framework. Offline-first PWA. Must say "Prototype, not a medical device", must not imply a diagnosis, and
must not use NASA branding. The team's visual language is shared with their NullBase project (layered ink + offset shadow,
Space Grotesk / Inter / JetBrains Mono).

**References:** NullBase (team's own app, `~/Desktop/Null Base`). There is no external competitor set.

**Method note:** evidence was gathered inline by the orchestrator with direct measurement (CSS scans, a DOM probe, a
build-size check, WCAG contrast maths, and screenshots from this session) instead of five subagents, to save
tokens. Every finding cites a file:line or a measured value.
