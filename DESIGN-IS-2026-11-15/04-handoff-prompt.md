# 04 — /make-plan handoff (REDESIGN)

````
/make-plan Redesign the Crew Mirror web app UI (web/src — app shell and sidebar, Today, Daily check, Plan, Calendar, 3D body, Report pain, Exercise coach, Balance, Settings; first-open setup in Welcome.tsx). Current design failed a Dieter Rams audit at 15/30, with critical gaps in principles #3 aesthetic (1), #4 understandable (1), #7 long-lasting (1), #8 thorough (1) and #10 as little design as possible (1).

Primary user: an astronaut on a long mission (also used before launch and after landing) — often alone, offline, tired, not a clinician. Primary task: do the 2-minute daily check and know what to do today. Secondary: when something hurts, say where and get a safe next step.
Constraints: NASA Space Apps Seoul 2026, due 2026-11-15 23:55 KST; React + Vite + TypeScript, no UI framework; offline-first PWA; "Prototype, not a medical device" on every page; results are patterns, never diagnoses; no NASA branding; English only.

Verdict paragraph (quoted from 03-verdict.md):
> Crew Mirror's logic and honesty are sound, but at 15/30 its interface has no enforced visual system, too much repeated chrome and jargon, and missing focus and error states, so the screens should be redesigned from purpose outward while keeping the engines, status semantics and brand tokens.

Why redesign and not refine: the total (15) is below the 20 threshold, and the weak scores come from the shared CSS and layout patterns used on every page, not from a single screen.

Preserve from current design:
- Brand colour tokens: teal hsl(168 76% 55–62%) and violet hsl(262 83% 58%) — web/src/styles.css :root.
- Status semantics and colours: Learning / Usual / Watch / Act / No data (web/src/engine/status.ts LEVEL_LABEL; --usual/--watch/--act/--nodata/--baseline tokens in styles.css).
- Plain-language status wording and the "How we know" fold for the statistics — web/src/engine/describe.ts.
- The 3D "Body" mannequin view with Body / Muscles / Bones / Nerves presets — web/src/body3d/BodyViewer.tsx (VIEWS, SOLID_SKIN).
- The first-open setup flow and the "How to use" guide content — web/src/screens/Welcome.tsx.
- All rule engines, data and offline behaviour (web/src/engine/*, web/src/data/*, server/, shared/). This is a UI redesign only; do not change logic.
- The teammate-owned login and person-switching behaviour (web/src/data/cloud.ts, web/src/site/Auth.tsx, the crew selector) — restyle only, do not change behaviour.

Discard:
- The hard offset-shadow "layered" decoration as the default for buttons, banners and nav. Evidence: styles.css .btn.primary/.btn.violet/.btn.danger, .banner box-shadow. Caused failure on principle #7.
- Ad-hoc styling: 24 font sizes, 22 spacing values, 87 CSS colour literals, 39 inline hex and 173 inline style={{}} objects. Evidence: web/src/styles.css; grep 'style={{' web/src. Caused failure on principle #3.
- Two parallel header systems (.kicker ×18 vs .card-h ×10) and two chip systems (.chip vs .todo-tag). Evidence: Welcome/Body/Report/Calendar/Coach use .kicker. Caused failure on principle #3.
- Today's duplicated affordances: the daily check offered 3× (Today.tsx:42, Today.tsx:60, engine/plan.ts:39) and every Act/Watch metric shown twice (list + tile; 18 cards, 21 chips with sample data). Caused failure on principle #10.

Top moves from the audit (verbatim):
1. #10 / #2 — One home screen, one action. Today offers the daily check 3× (Today.tsx:42, :60, plan.ts:39) and repeats every Act/Watch metric as both a list item and a tile (18 cards, 21 chips). Show one status summary, one primary action and one "next" item; move the tiles to Trends.
2. #3 — A real token system. Replace the 24 font sizes, 22 spacing values, 87 CSS colours + 39 inline hex and 173 inline style objects with a 6-step type scale, a 4-pt spacing scale and ≤ 14 colour tokens. One header style (retire .kicker ×18) and one chip style.
3. #4 — Say it in plain words. Rename the units "×IPD" and "% SW" (shared/metrics.json:39,79,87,95) and the label "PERCLOS" (metrics.json:30); explain or drop the "Habitat link" pill; turn "pfu / S-scale" into a one-line plain status.
4. #8 — Finish the edges. A visible focus ring on every interactive element (remove outline: none, styles.css:122); camera errors that say what to do (DailyCheck.tsx:214, Balance.tsx:134, Coach.tsx:112, PointToPain.tsx:87); a confirm step before "Show sample crew" wipes your data (Settings.tsx:108); AA-passing light status chips (currently 4.14:1 and 4.28:1).
5. #7 — Drop the trend markers. Retire hard offset shadows as the default decoration, glass blur and mono uppercase micro-labels. Keep one quiet elevation style so the app still looks current in 3 years.

Redesign principles in priority order:
1. #2 Useful — Today answers "how am I and what do I do now" in one glance: one status sentence, one primary button, one next item.
2. #4 Understandable — a first-time astronaut can name every control and unit without help; no unexplained acronyms outside "How we know".
3. #10 As little design as possible — every element on each screen earns its place; no affordance is repeated on the same screen.
4. #8 Thorough — empty, loading, error, success, focus and disabled designed for every camera, 3D and form surface.
5. #3 Aesthetic — one type scale, one spacing scale, ≤ 14 colour tokens, zero inline hex.

Deliverables for the plan:
- New information architecture (not derived from the old sidebar): screen map for the primary task and the pain flow.
- New primary flow (low-fi, labelled) for first open → daily check → result → today's plan, compared side by side with the current flow.
- Token spec: type scale (6 steps), spacing (4-pt), colour tokens (≤ 14, light and dark, AA verified), one elevation style, one header and one chip component.
- States checklist (empty, loading, error, success, focus, disabled) per screen, including camera permission denied, models unavailable offline, and 3D loading.
- Migration path: replace screens one by one behind the same routes (#/app/<tab>); keep storage key crew-mirror:v2 so user data survives.
- Cutover criteria: all screens on the new tokens, zero inline hex, no .kicker, axe/contrast pass, re-audit with /claude-mem:design-is scoring ≥ 24/30.

Anti-patterns to guard against (specific to REDESIGN):
- Porting the old structure under new styling (e.g. keeping three daily-check CTAs on Today with new colours).
- Keeping both designs behind a flag indefinitely.
- Redesigning to follow a trend rather than the principles above.
- Treating the Preserve list as optional — especially the logic, the status semantics and the teammate-owned login/person behaviour.
- Running out of time: before 17:30 KST, prioritise moves 1, 3 and 4; moves 2 and 5 can land as a token pass after.
````
