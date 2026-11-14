# shared/

Rule definitions and test cases used by **both** the browser engine (`web/src/engine`, TypeScript)
and the habitat server engine (`server/app/engine.py`, Python).

- `triage_cases.json` — input → expected triage level + pattern. Run by `npm test` (vitest) and
  `pytest` so the two implementations can never drift apart.
- `status_cases.json` — metric history → expected status (Usual / Watch / Act / No data / Baseline).
