# 02 — Scorecard (Dieter Rams, 0–3 each, worst instance, ties go to the lower score)

1. **Good design is innovative — Score: 2/3**
   - **Evidence:** a camera-only daily check against a personal baseline; point-to-pain from pose + hand landmarks;
     a referred-pain source finder lit on 3D anatomy (01 §E1–E3).
   - **Justification:** it clearly improves existing health-check patterns, but the surface still carries trend
     flourishes, so "shipped with restraint" (the 3 anchor) isn't met.

2. **Good design makes a product useful — Score: 2/3**
   - **Evidence:** the daily check is 1 tap from Today and done in 3 steps. Adjacent surface adds noise: the same
     check is offered 3× on Today (`Today.tsx:42`, `:60`, `plan.ts:39`), and there are 25 interactive elements in
     main (E1).
   - **Justification:** the primary task completes directly, but the surface around it adds decoy and duplicate
     steps.

3. **Good design is aesthetic — Score: 1/3**
   - **Evidence:**
     - 24 font sizes;
     - 22 spacing values;
     - 87 CSS colour literals + 39 inline hex + 173 inline style objects;
     - two header systems (`.kicker` ×18 vs `.card-h` ×10);
     - two chip systems (E2).
   - **Justification:** there are five categories of inconsistency. A visual language exists, but no single
     enforced system.

4. **Good design makes a product understandable — Score: 1/3**
   - **Evidence:** "×IPD", "% SW", "PERCLOS", "pfu/S-scale"; the unexplained "Habitat link" pill; a "Crew" selector
     with one person (E3).
   - **Justification:** 2–3 controls or labels are unclear to a first-time user, and jargon is present.

5. **Good design is unobtrusive — Score: 2/3**
   - **Evidence:** chrome is sidebar + topbar (3 pills) + footer + sample bar. With data, Today shows 18 cards and
     21 chips (E1).
   - **Justification:** the chrome is quiet, but status chrome competes with the content on the data-rich Today.

6. **Good design is honest — Score: 2/3**
   - **Evidence:** estimates labelled, "No data ≠ fine", disclaimer on every page, sample crew labelled. One
     inflation: "Works without internet — everything runs on this device", while the deployed build fetches models
     and fonts online on first use (E3).
   - **Justification:** exactly one minor inflation and no dark patterns.

7. **Good design is long-lasting — Score: 1/3**
   - **Evidence:** hard offset "brutalist" shadows on buttons and banners (`styles.css` `.btn.primary`,
     `.banner`); glassmorphism blur on the topbar and 3D controls; mono uppercase micro-labels — all 2023–25 trend
     markers (E2).
   - **Justification:** three dated trend markers.

8. **Good design is thorough down to the last detail — Score: 1/3**
   - **Evidence:**
     - **Error states are raw:** `Camera or model failed: ${err}` on 4 surfaces.
     - **Focus is effectively missing:** `outline: none` at `styles.css:122`; no `.nav-item` / clickable-card focus.
     - **Destructive "Show sample crew" has no confirm:** `Settings.tsx:108`.
     - **Light chips fail AA:** 4.14 and 4.28:1 (E2, E5).
   - **Justification:** two states are missing or rough (error, focus), plus a destructive edge case.

9. **Good design is environmentally friendly — Score: 2/3**
   - **Evidence:**
     - ≈238 KB gzip initial JS;
     - 3D and models lazy-loaded;
     - no infinite idle animation;
     - reduced-motion respected;
     - but the first paint ignores the system dark preference (`index.html:17`) (E4).
   - **Justification:** under 500 KB with motion gated meets the 2 anchor; it exceeds the 100 KB bar for 3.

10. **Good design is as little design as possible — Score: 1/3**
    - **Evidence:** removable elements on Today: the duplicate check CTA ×2 (checklist + plan item), the "Exercise
      coach" hero button, metric tiles that repeat the "How you're doing" list, and a full-size radiation card on
      the home screen (E1).
    - **Justification:** 3–5 elements could be removed without breaking the task.

**Total: 15 / 30.** No principle scored 0.
