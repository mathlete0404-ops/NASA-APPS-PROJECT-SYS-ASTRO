# 01 — Evidence (facts only, no scores)

## E1 Structural
- **Interactive elements:** Today with sample data has 25 in `main` and 58 on the whole page (DOM probe:
  `a[href], button, input, select, textarea, summary`).
- **Max nesting depth** in Today's `main`: 7.
- **Repeated affordances for the same purpose:**
  - **"Do the daily check" appears 3× on Today:** the hero button `Today.tsx:60`, the checklist item `Today.tsx:42`
    and the plan item from `plan.ts:39`. With the sidebar it's 4.
  - **"Report pain" has 5 entry points:** sidebar, `Today.tsx:63`, `Body.tsx:42–43`, `Coach.tsx:146` and the Report
    result. Most are contextual.
  - **"Exercise coach" has 4:** sidebar, `Today.tsx:64`, `Plan.tsx:84`, `Report.tsx:330`.
  - **Each Act/Watch metric shows twice on Today:** once in the "How you're doing" list and again as a tile, with
    18 cards and 21 status chips on one screen (DOM probe, PLT).
- **Dead props / unused imports:** 0 (`tsc -b` with `noUnusedLocals` / `noUnusedParameters` passes).
- **Inline style objects:** 173 `style={{…}}` across `src/**/*.tsx`.

## E2 Visual (from source, plus screenshots taken this session)
- **Type scale:** 24 distinct font sizes in `styles.css`: .66 .68 .7 .72 .74 .75 .76 .78 .8 .82 .85 .88 .9 .92 .95 1
  1.02 1.05 1.12 1.15 1.3 1.65 1.8 2.3 rem. There is no stepped scale.
- **Spacing:** 22 distinct px values (1 2 3 4 5 6 7 8 9 10 11 12 13 14 16 18 20 24 26 28 32 48).
- **Colours:** 87 distinct colour literals in `styles.css`, plus 39 distinct hex literals inline in TSX.
- **Fonts:** 3 families (Space Grotesk, Inter, JetBrains Mono).
- **Header styles:** two coexist — the mono uppercase `.kicker` (18 uses: Welcome 5, Body 3, Report 3, Calendar 2,
  Coach 2, Plan 1, Today 1, Auth 1) and the new `.card-h` title (10 uses).
- **Chip styles:** two coexist — `.chip` (mono uppercase, outlined) and `.todo-tag` (filled tint).
- **Lowest primary-text contrast (WCAG):**
  - light `--watch` on `--watch-bg`: 4.14:1 (fails AA for small text at 0.72rem);
  - light `--usual` on `--usual-bg`: 4.28:1 (fails AA small);
  - muted text 4.89–6.62:1 (passes).
- **States:**
  - **empty:** present (Today, Trends, Calendar, Body, Coach).
  - **loading:** present (boot splash, 3D "Loading … %", camera "Starting…"), though the app root still shows a plain
    "Loading…".
  - **error:** rough. All four camera surfaces show raw `Camera or model failed: ${err}` with no recovery step
    (`Balance.tsx:134`, `DailyCheck.tsx:214`, `Coach.tsx:112`, `PointToPain.tsx:87`).
  - **success:** present ("Check saved", "Saved ✓").
  - **focus:** weak. `.lift:focus-visible` sets `outline: none` (`styles.css:122`); `.btn:focus-visible` only
    changes the background (`styles.css:389`); `.nav-item` and the clickable `.card` tiles have no focus rule.
  - **disabled:** present (`.btn:disabled` at opacity .45).
- **Destructive action without confirmation:** "Show sample crew" replaces the user's own data in one click; the
  hint text warns, but there is no confirm step (`Settings.tsx:108`).

## E3 Copy & honesty
- **Estimates are labelled:** "Heart rate (estimate)", "Breathing rate (estimate)", "Estimate, not a medical
  reading".
- **"No data" is never shown as "fine":** `describe.ts`, `status.ts`.
- **Safety copy:** "Prototype, not a medical device" appears on every page (`ui.tsx` Footer).
- **Sample crew** is labelled (`App.tsx` sample bar).
- **Jargon in user-facing labels or units:**
  - "Eye closure (PERCLOS)" (`shared/metrics.json:30`);
  - unit "×IPD" (`metrics.json:39`);
  - unit "% SW" ×3 (`metrics.json:79,87,95`);
  - "pfu", "S-scale" (`SpaceWeatherCard.tsx`);
  - "Habitat link" pill (`App.tsx`), never explained;
  - "Crew" selector shown even with one person.
  - "ARED" and "EVA" are domain terms the audience knows.
  - "z", "MAD" and "robust" appear only inside "How we know" folds.
- **Inflation candidate:** the setup says "Works without internet — Everything runs on this device"
  (`Welcome.tsx`). However, the MediaPipe `.task` models are gitignored (`web/.gitignore:3`), so the deployed build
  downloads them from Google on first use, and fonts load from Google Fonts. True after the first use, not on a
  first offline open.
- **Dark patterns:** none found. No forced continuity, hidden cost, fake scarcity or confirmshaming. Superlatives:
  none found.

## E4 Weight & friction
- **Initial JS, gzip:**
  - `index` 185 KB + `dist` (Supabase, loaded at start when cloud is configured) 53 KB ≈ 238 KB;
  - raw 756 + 211 KB.
- **Lazy:** the 3D viewer is 267 KB gzip, and the GLB models are 5.7 MB. The MediaPipe worker is 154 KB, plus
  3.8–5.8 MB models when a camera feature first runs.
- **Idle animations:** no infinite keyframes. There are 3 one-shot keyframes (boot, app-in, page-in), all gated
  by `prefers-reduced-motion` (3 rules).
- **Network:** NOAA space weather is polled every 5 min while Today is open (`SpaceWeatherCard.tsx`).
- **Theme:** dark mode exists, but the first paint ignores the system `prefers-color-scheme` (`index.html:17`
  only reads the saved choice, so the default is light).
- **Modals/badges on load:** 0 modals; setup runs only on first open.

## E5 Accessibility
- **Landmarks:** `aside`, `header`, `main`, 2× `nav`, `footer` (`App.tsx`, `ui.tsx`).
- **Skip link:** none.
- **Keyboard order:** brand → collapse → 4 main → 4 body → More → … → profile → content. That's 14+ stops before
  the main content.
- **Unnamed buttons:** 0; images without alt: 0 (DOM probe).
- **Contrast failures:** light status chips (4.14:1 and 4.28:1 at 0.72rem), see E2.
- **Focus indicators:** missing or weak on nav items, clickable cards and buttons (E2).
