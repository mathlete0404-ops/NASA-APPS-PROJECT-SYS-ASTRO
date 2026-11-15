# 03 — Verdict: REDESIGN

**Crew Mirror's logic and honesty are sound, but at 15/30 its interface has no enforced visual system, too much
repeated chrome and jargon, and missing focus and error states, so the screens should be redesigned from purpose
outward while keeping the engines, status semantics and brand tokens.**

Rule applied mechanically: the total is below 20, so REDESIGN, even though no single principle scored 0. This is not
"one ugly screen". The weak scores (#3, #4, #7, #8, #10) come from the shared CSS and the layout patterns used on
every page.

## Highest-leverage moves
1. **#10 / #2 — One home screen, one action.** Today offers the daily check 3× (`Today.tsx:42`, `:60`, `plan.ts:39`)
   and repeats every Act/Watch metric as both a list item and a tile (18 cards, 21 chips). Show one status summary,
   one primary action and one "next" item; move the tiles to Trends.
2. **#3 — A real token system.** Replace the 24 font sizes, 22 spacing values, 87 CSS colours + 39 inline hex and
   173 inline style objects (E2) with a 6-step type scale, a 4-pt spacing scale and ≤ 14 colour tokens. One header
   style (retire `.kicker` ×18) and one chip style.
3. **#4 — Say it in plain words.**
   - Rename the units "×IPD" and "% SW" (`shared/metrics.json:39,79,87,95`) and the label "PERCLOS"
     (`metrics.json:30`).
   - Explain or drop the "Habitat link" pill.
   - Turn "pfu / S-scale" into a one-line plain status.
4. **#8 — Finish the edges.**
   - A visible focus ring on every interactive element (remove `outline: none`, `styles.css:122`).
   - Camera errors that say what to do (`DailyCheck.tsx:214`, `Balance.tsx:134`, `Coach.tsx:112`,
     `PointToPain.tsx:87`).
   - A confirm step before "Show sample crew" wipes your data (`Settings.tsx:108`).
   - AA-passing light status chips.
5. **#7 — Drop the trend markers.** Retire hard offset shadows as the default decoration, glass blur and mono
   uppercase micro-labels. Keep one quiet elevation style so the app still looks current in 3 years.
