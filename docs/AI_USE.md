# Use of AI tools (for the "Use of SI" submission field)

One line per meaningful AI-assisted change: date/time (KST) · tool · files · what it did.

| When (KST) | Tool | Files | What |
| --- | --- | --- | --- |
| 2026-11-14 09:50 | Claude Code (Claude Opus 5.5) | `ingest/osdr_inspiration4.py`, `ingest/nasa_catalog.py`, `data/*` | Wrote ingest scripts; downloaded Inspiration4 CBC/CMP (OSD-569/575) and computed personal-vs-population range evidence; built offline data.nasa.gov catalog snapshot |
| 2026-11-14 10:00 | Claude Code (Claude Opus 5.5) | `shared/*.json`, `server/` | Shared rule tables and test cases; FastAPI + SQLite habitat server with status engine, triage, crew overview, downlink, NASA search; pytest suite |
| 2026-11-14 10:10 | Claude Code (Claude Opus 5.5) | `web/src/engine/*`, `web/src/vision/*` | TypeScript status/triage engines (same shared cases), rPPG (POS) estimator, face-scan and balance metrics, MediaPipe Web Worker; vitest suite |
| 2026-11-14 10:20 | Claude Code (Claude Opus 5.5) | `web/src/screens/*`, `web/src/content/*`, `web/src/data/*` | App screens (today, daily check, symptom flow, balance, trends, evidence, CMO view), why-it-hurts cards, exercises, offline store, synthetic demo crew |
| 2026-11-14 10:45 | Claude Code (Claude Opus 5.5) | `web/src/site/*`, `web/src/App.tsx`, `web/src/styles.css`, `web/index.html` | Landing site and sidebar app shell in the team's layered NullBase-style design language; light/dark theme; mobile layout |
| 2026-11-14 10:55 | Claude Code (Claude Opus 5.5) | `README.md`, `docs/SUBMISSION.md` | README (run steps, limitations, references) and draft submission text |
| 2026-11-14 11:10 | Claude Code (Claude Opus 5.5) | `ingest/blender/export_body.py`, `web/public/models/*.glb`, `web/src/generated/anatomy_manifest.json` | Headless Blender pipeline: Z-Anatomy → selected structures (sex-specific anatomy removed) → decimated Draco GLB layers with region tags |
| 2026-11-14 11:15 | Claude Code (Claude Opus 5.5) | `web/src/body3d/*`, `web/src/screens/Body.tsx`, `web/src/screens/Report.tsx`, `web/src/content/sources.ts` | 3D body viewer (layers, x-ray, peel-through picking, search, problem overlay), pain-source finder, rebuilt report flow |
| 2026-11-14 11:20 | Claude Code (Claude Opus 5.5) | `web/src/engine/pointing.ts`, `web/src/components/PointToPain.tsx`, `web/src/vision/*` | Point-to-pain with Pose + Hand Landmarker; 3D world landmarks from the worker |
| 2026-11-14 11:25 | Claude Code (Claude Opus 5.5) | `web/src/engine/coach.ts`, `web/src/engine/resp.ts`, `web/src/screens/Coach.tsx` | Exercise coach (reps, 3D joint angles, form cues, export) and breathing-rate estimate; tests |
| 2026-11-14 11:30 | Claude Code (Claude Opus 5.5) | `web/src/engine/plan.ts`, `web/src/content/nutrition.ts`, `web/src/screens/{Plan,Calendar,Settings}.tsx` | Plan (recommendations, exercise, nutrition), calendar, settings |
| 2026-11-14 11:35 | Claude Code (Claude Opus 5.5) | `web/src/data/cloud.ts`, `web/src/site/Auth.tsx`, `supabase/migrations/*` | Supabase auth + sync code and RLS schema (project not yet created) |
| 2026-11-14 11:40 | Claude Code (Claude Opus 5.5) | `server/app/engine.py`, `shared/*`, `web/src/engine/*`, `docs/FEATURE_REVIEW.md` | Audit fixes: per-day baseline, new regions, balance gated by phase, in-flight exercises, yaw gate; feature review doc |
| 2026-11-14 11:15 | Claude Code (Claude Opus 5.5) via Supabase connector | Supabase project `crew-mirror`, `supabase/migrations/*`, `web/.env.local` (not committed) | Created the free project (user-approved), applied schema + RLS, moved the RLS helper to a private schema, merged read policies, tested RLS with throwaway users (then deleted), made the medical-officer role admin-approved only |
