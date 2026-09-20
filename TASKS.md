# Evosim (formerly Evolutionary Planet) — Project Specification (v3, full reset)

> **Note**: For historical details/tester evidence, see `TASKS_ARCHIVE.md`.
> Each phase here has a 1-3 line summary; the full implementation details and
> independent tester verification reports are kept in chronological order in
> the archive file (under headings like `TASKS_ARCHIVE.md#faz-i`).

## Note on previous versions
- **v1** (a "life simulation" with Webbed-style cute/cartoon creatures):
  rejected by the user — "I asked for an evolution simulation, not a life
  simulation."
- **v2** (circular planet + scientific/D3 dashboard: phylogenetic tree, trait
  histograms, tabbed panel): also rejected by the user — the menu/dashboard
  was found too complex; the concept should be "a real evolution/organ-gain
  process starting from a microorganism" rather than "ready-made creatures
  living on a planet," and a flat map (water+land) was wanted instead of a
  circular planet.
- This document and codebase were **rewritten from scratch again** (v3).
  Some v2 subsystems (genome/mutation core logic, generation tracking,
  save/load, speed control architecture) were conceptually reused, but the
  **planet/world model, the creature starting point (now a microorganism),
  and the ENTIRE UI/dashboard were completely redesigned.**

## New Vision (v3)
An evolution simulation with a simple/minimal interface, seeking to answer
the question "how would creatures have evolved starting from a
microorganism."

## World Model
- **A flat map** (NO circular planet). A fixed-size (1600×1000), rectangular
  area.
- The map is generated procedurally **once, at the start** (value-noise, no
  extra library): water/land. Since Phase VIII, the map seed is generated
  randomly on every new page load (compatible with save/load).
- **Terrain variety (Phase XVII)**: the same raw noise value is reused as
  "elevation" and split into 5 types (deep water/shallow water/beach/
  plains/mountain) — this is purely a visual/categorical extra layer;
  `terrainAt`/`isWater` (the binary distinction all movement/spawn logic
  relies on) is unchanged.
- **Planet formation screen (Phase XVI)**: before each new simulation
  starts, an atmosphere/biomass summary DERIVED (deterministically) from the
  map seed is shown along with a short narrative, and the user continues
  with "Start Simulation." This screen never opens when loading a save.
- "Planet info": water/land %, shallow/deep water split, atmosphere/oxygen
  level (Phase X) — shown in the HUD's "Details" panel.

## Creature Model — Open-Ended Evolution Starting from a Microorganism
- **Start**: All creatures begin as **single-celled/organless
  microorganisms**. They live in water regions.
- **Open organ pool**: Mutation gives a chance to add a new organ/limb TYPE
  to the genome over time (there's NO fixed "evolutionary tree" order).
  Categories: movement (fin/leg/wing/tentacle), sensing (eyespot/eye),
  feeding (mouth/stomach), defense (shell/camouflage/spike), respiration
  (gill/lung), internal organ (heart), hibernation/insulation/
  bioluminescence/venom/regeneration (Phase XIV: torpor/blubber/
  bioluminescence/venom/regeneration), planet-specific (Phase XVI:
  `nitrogen_sac`/`sulfur_vent_organ`, only possible on a suitable planet
  profile). 21 types, the list isn't closed.
- **Water → land transition**: A creature with a leg organ can move onto
  land and survive/feed there too.
- **Cause/rationale transparency**: when an organ emerges/spreads/dies out,
  a real, threshold-based event is logged to the event log (Phase III) — no
  fabrication.
- **Diet/ethology (Phase IX/XIII/XVII)**: `diet: herbivore|carnivore`,
  wander/seek/flee/hunt state machine, boundary awareness/real food seeking,
  **pack hunting** (`packHunter` gene — the number of nearby carnivores of
  the same type increases hunting success).
- **Reproductive diversity (Phase VII)**: asexual division + opportunistic
  sexual reproduction (crossover) + egg-laying + simple offspring care, all
  able to coexist.
- **Life cycle (Phase IX)**: death from old age via the `maxLifespan` gene.
- **Death/decomposition (Phase VI/XI)**: death is visible (corpse/skeleton),
  decomposer bacteria consume corpses and leave a small contribution to the
  food pool.
- **Organ descriptions (Phase XIV)**: the inspection panel shows a short
  sentence describing each organ's actual mechanical effect.
- **Lineage tree (Phase VI/XII/XVI)**: OFF by default, an overlay opened
  with a button; zoom/pan/filter (diet/organ/state/generation),
  organ-color ring, bezier parent→child branching. Very large lineages are
  NOT deleted entirely — old blocks are compressed into a summary node (no
  data loss); canvas vertical size is capped (`MAX_CONTENT_HEIGHT`, Phase
  XVII).

## Interface — Minimal Menu
- v2's tabbed D3 dashboard was COMPLETELY removed. Main focus is the
  map+creature scene.
- A single, compact side panel: the primary 2x2 stat grid is always
  visible; secondary info (World/Diet/Atmosphere) is in a "▾ Details"
  panel that's collapsed by default.
- **Evolution event feed (event log)**: short lines when an organ
  emerges/spreads/dies out. Individual hunting events are DELIBERATELY kept
  out of the log (a noise-reduction decision, Phase X).
- Creature inspection panel (via click) + selection ring + Gemini "Analyze
  this lineage" button.
- Header: speed control (II/1x/2x/4x) + Restart + Export/Import + manual
  natural-event controls (Phase XII), with thin separators between groups.
  (The multi-save-slot feature added in Phase XI was removed at the user's
  request — reverted to single-slot auto-save, see
  `TASKS_ARCHIVE.md#phase-xi--multiple-save-slots-added-then-removed-archive`.)
- Responsive: on narrow screens, the panel moves below the scene and
  becomes a single column.

## Technical Stack
- Vite + TypeScript + PixiJS (scene rendering).
- D3.js is not used — the lineage tree is drawn with plain `<canvas>` 2D.
- A simple value-noise function is sufficient for map generation.
- Gemini API (`gemini-flash-lite-latest`) — a server-side proxy
  (`vite.config.ts`, `/api/gemini-insight`); the key is NEVER sent to the
  client, and is kept in `.env`.

## Phase Summary and Status

All phases are COMPLETE and verified as PASSED by an independent tester,
unless otherwise noted. See `TASKS_ARCHIVE.md` for details.

- **Phase I — World + microorganism skeleton**: COMPLETE, Tester PASSED.
  `TASKS_ARCHIVE.md#faz-i`.
- **Phase II — Open organ system**: COMPLETE, Tester PASSED.
  `TASKS_ARCHIVE.md#faz-ii`.
- **Phase III — Cause/rationale transparency**: COMPLETE, Tester PASSED.
  `TASKS_ARCHIVE.md#faz-iii`.
- **Phase IV — Population collapse fix**: COMPLETE. The root cause was food
  ACCESSIBILITY, not QUANTITY. `TASKS_ARCHIVE.md#faz-iv`.
- **Phase V — Creature inspection + reproduction/growth visuals + Gemini
  deep analysis**: COMPLETE, Tester PASSED. `TASKS_ARCHIVE.md#faz-v`.
- **Phase VI — Death visibility, lineage tree, selection ring, lineage
  extinction, decomposers**: COMPLETE, Tester PASSED.
  `TASKS_ARCHIVE.md#faz-vi`.
- **Phase VII — Mating, egg-laying, offspring care + light Gemini
  guidance**: COMPLETE, Tester PASSED. `TASKS_ARCHIVE.md#faz-vii`.
- **Phase VIII — Random map + world events**: COMPLETE, Tester PASSED.
  `TASKS_ARCHIVE.md#faz-viii`.
- **Phase IX — Bug fixes + diet system + ethology**: COMPLETE, Tester
  PASSED. `TASKS_ARCHIVE.md#faz-ix`.
- **Phase X — Shallow/deep water + hunting log noise + respiration
  organs/atmosphere**: COMPLETE, Tester PASSED. `TASKS_ARCHIVE.md#faz-x`.
- **Phase XI — Continuous Improvement**: an open-ended phase, maintained by
  the PM. Details and current candidate pool below.
- **Phase XII — Manual controls + lineage tree improvements**: COMPLETE,
  Tester PASSED. `TASKS_ARCHIVE.md#faz-xii`.
- **Phase XIII — Behavior AI quality + food-collapse bug**: COMPLETE AND
  CLOSED. Root cause found and fixed; total of 20 short runs + one full
  22-minute intensive-intervention run = zero collapses, zero real errors.
  The single incident the user reported was likely a stale/HMR-drifted dev
  server tab (fixed). `TASKS_ARCHIVE.md#faz-xiii`.
- **Phase XIV — New/unusual organs + lineage-tree selection bug + organ
  descriptions**: Item 1 (5 new organs) and Item 3 (organ descriptions)
  COMPLETE, Tester PASSED. Item 2 (lineage-tree selection-ring bug) could
  NOT be REPRODUCED by either the coder or the tester — open, see "Current/
  Open Issues" below. `TASKS_ARCHIVE.md#faz-xiv`.
- **Phase XV — Performance regression: FPS collapse at population cap**:
  COMPLETE AND CLOSED. Root cause (fixed-timestep wrapping + O(n²) sqrt
  cost) found and fixed; system-idle independent verification also
  completed (FPS plateaus between 14-25.4, the old "death spiral" was never
  seen again). `TASKS_ARCHIVE.md#faz-xv`.
- **Phase XVI — Professional lineage tree + planet formation screen +
  planet-specific organs**: COMPLETE, Tester PASSED (3/3 items). Lineage
  tree summary node (zero data loss) + bezier visual redesign; planet
  formation screen (deterministic, save/load compatible); 2 new
  planet-specific organs + a filtering layer. `TASKS_ARCHIVE.md#faz-xvi`.
  An independent performance/integration audit afterward also PASSED (Phase
  XV's spiral did not return).
- **Phase XVII — Freeze bug + pack behavior + terrain variety**: COMPLETE,
  Tester PASSED (4/4 items, verified across TWO separate independent tester
  rounds). Map-boundary freeze bug (definitive root cause, two-part fix);
  `packHunter` pack-hunting gene (measurable effect: 8%/ally, 35% cap); 5-type
  terrain variety (elevation-projection, performance-cached); lineage-tree
  canvas height cap (fixed the visual-durability finding from Phase XVI).
  `TASKS_ARCHIVE.md#faz-xvii`.
- **Phase XVIII — Delayed mass population-collapse bug on long runs
  (2026-09-10/11)**: COMPLETE AND CLOSED. Root cause: during a climate
  event, nutrients rapidly accumulate at population locations and hit the
  cap; once the event ends and the population moves, the stock stays
  "frozen" at the old locations. Fix: `ecosystem.ts`
  `relocateStrandedNutrient()` — moves stranded nutrient near a hungry
  individual. TOTAL of 7/7 independent verifications PASSED (5 short runs +
  1 extended run + 1 completely different scenario/tester).
  `TASKS_ARCHIVE.md#faz-xviii`.
- **Phase XIX — Organ diagram not showing on dead/lineage-tree individuals
  (2026-09-11)**: COMPLETE AND CLOSED. Root cause: `buildCreatureDiagram`
  was only called when a live individual was selected (`showInspector`), it
  was never called in `showDeceasedInspector`. Fix: made the `diet`
  parameter nullable (neutral gray color) and added the same diagram call
  to `showDeceasedInspector`. Tester PASSED (independent, 0f — with a
  different organ/individual combination, a real death record with a
  `lung` organ). `tsc` clean. `TASKS_ARCHIVE.md#faz-xix`.
- **Phase XX — New organ: Chromatophore (active camouflage) (2026-09-11)**:
  COMPLETE. 22nd organ type — squid-inspired, a reactive escape chance that
  kicks in AT THE MOMENT OF CAPTURE (`chromatophoreReactiveEscapeChance()`,
  `0.12+power*0.2`), mechanically distinct from the static `camouflage`.
  **Tester PASSED (independent, 2b)**: the "no fabrication" principle was
  verified against the code line, tested with a combined scenario of
  different power values + camouflage. `TASKS_ARCHIVE.md#faz-xx`.
- **Phase XXI — New organ: Symbiotic Gut Flora (2026-09-11)**: COMPLETE.
  23rd organ type — on a different axis from `mouth`/`stomach`, shortens
  the post-hunt digestion cooldown (`digestCooldownMultiplier()`,
  `1-power*0.5`). **Tester PASSED (independent, 2b)**: tested with
  different power values + a combined scenario; the claim that it "only
  matters for carnivores" was verified both by tracing the code path and
  with a live test (force-added to an herbivore and run for 15s, behavior
  was completely unaffected). `TASKS_ARCHIVE.md#faz-xxi`.
- **Phase XXII — Dead-code cleanup in small helper files (2026-09-13)**:
  COMPLETE. Coder a7's bug-hunting sweep (`angle.ts`/`color.ts`/`rng.ts`)
  found 3 real pieces of dead code — none were imported/called anywhere
  (confirmed via grep): `angle.ts`'s ONLY function `shortestAngleDiff` (the
  entire file), `color.ts`'s `muteColor` (confirmed that
  `genomeToPalette`'s "neutral/scientific look" goal was already achieved
  by constraining at the HSL stage, the post-processing approach was never
  used), `rng.ts`'s `pick`. PM 31 carried out the file deletion
  (`angle.ts`) within its own permission level and committed it
  (git-tracked/reversible). tsc --noEmit clean. `TASKS_ARCHIVE.md#faz-xxii`.
- **Phase XXIII — Project rename sweep: "Evolutionary Planet" → "Evosim"
  (2026-09-13, coder a7)**: COMPLETE. ALL tracked files were scanned with
  `git ls-files | grep` (except TASKS*.md — those intentionally contain a
  historical "formerly named" note, left untouched). 2 real user-visible
  remnants were found and fixed: (1) `exportimport.ts`'s
  `EXPORT_FILENAME_PREFIX` ("evrimsel-gezegen-kayit" → "evosim-kayit", the
  downloaded save filename, purely cosmetic, no format/compatibility
  impact — verified with Playwright that the correct filename is actually
  generated); (2) the two `"name"` fields in `package-lock.json` were
  synced with `package.json` ("evrimsel-gezegen" → "evosim", verified with
  `npm install --package-lock-only`, NO change to dependency versions). The
  old-name reference in the `dist/` folder (NOT git-tracked, a stale build
  artifact) was automatically fixed by rebuilding.

  **Deliberately left UNTOUCHED**: `savegame.ts`'s `SAVE_KEY =
  "evrimsel-gezegen-save-v8"` — this is a `localStorage` key, never visible
  in the user interface, but if changed, ALL existing saved games (in the
  user's browser) would silently become inaccessible (a different key =
  appears as "no save"). This isn't a pure rename, it's a
  backward-compatibility decision — should not be made without user/PM
  approval. Added to the candidate pool.

  tsc --noEmit and `vite build` clean. Committed (not pushed).
  `TASKS_ARCHIVE.md#faz-xxiii`.
- **Phase XXIV — `decomposer.ts`/`corpse.ts` dead code + fragile sync
  (2026-09-14, coder a7)**: COMPLETE. During the sweep, a public getter
  named `Decomposer.progress` was found — its docstring said "the Ecosystem
  can use this to speed up the decay rate of the attached corpse," but grep
  confirmed zero usages (dead code). Instead, `corpse.ts` was
  INDEPENDENTLY computing the consumption rate using its own `elapsed`
  counter with `LIFETIME*0.18` (≈3.96s) — only coincidentally close to
  `Decomposer.CONSUME_DURATION=4`, with no real connection. The `progress`
  getter was removed, and comments in both files were updated to clearly
  state that these two constants must be kept in MANUAL sync (if one
  changes, the other silently drifts). tsc/build clean, verified with a
  real 30-second simulation run (natural death/corpse/decomposer cycle),
  zero errors. Committed (not pushed).

## Current/Open Issues (to be addressed in the next PM/coder round)
- **Phase XIV Item 2 — lineage-tree selection bug**: the code was reviewed
  by both the coder and the tester, no real bug was found. Full
  reproduction steps are needed from the user (browser, window size, which
  node was clicked how) — hard to proceed without this information.

## Future Direction (not yet turned into a phase)
- **"Sandbox game" idea (2026-09-06)**: The user asked whether the project
  could eventually turn into a sandbox game. PM's assessment: YES, it's
  possible — the current architecture (planet generation, genome/organ
  system, manual food/natural-event controls, save/load) already carries
  the foundation of a "god game." What's actually missing: tools for DIRECT
  PLAYER INTERVENTION — e.g., manually placing creatures/editing organs,
  terrain shaping (terraforming), a goal/scenario/scoring system.
  **User's decision**: For now, continue in the current direction (a
  realistic, observable, "observer" evolution simulation); sandbox mode
  will be added LATER as a separate, optional mode — without diluting the
  main experience (the observer/scientific feel). No concrete phase/task
  has been opened yet; it can be detailed here as a phase whenever the user
  is ready.

## Autonomous Operation Mode (user request, 2026-09-06)
The user is going away and wants the project to keep perfecting itself
continuously. Roles are SEPARATED (3 separate sessions, 3 separate crons):
- **PM** (this session, cron already active): task distribution, processing
  coder/tester reports, picking new tasks from the candidate pool,
  archiving, summary for the user (when they return).
- **Coder** (a separate peer session, its own cron): waits for tasks from
  the PM, or if idle, picks its own from the candidate pool/open issues in
  TASKS.md.
- **Tester** (a separate peer session, its own cron): tests phases the
  coder has completed but that are awaiting independent verification.
- **User request — both frontend and backend work**: The project so far has
  been pure frontend (Vite+PixiJS SPA + a small Vite dev-server proxy), with
  no real backend. The user expects backend work too — an API that can
  export population/lineage data + time-series history is **COMPLETE** (see
  below). Remaining candidate ideas: moving the Gemini proxy to a real/
  persistent backend service, a server component for future
  multiplayer/shared state. The coder's cron should evaluate this in
  upcoming rounds — if it would be a major architectural change (e.g.,
  adding a real Node/Express backend), the PM (and the user, when they
  return, if necessary) should be consulted first.

### Population Telemetry API (2 rounds, COMPLETE, Tester PASSED)
`/api/population-snapshot` (GET/POST) + `/history` (ring buffer, last 50
records) — a read-only telemetry API exposing live population/lineage data
externally, in-memory, not an architectural change (PM-approved).
`TASKS_ARCHIVE.md#faz-xi-telemetri-zaman-serisi`.

### Broad health sweep (tester, 2026-09-10)
Save/load, export/import, Gemini proxy, and telemetry were scanned — 1
CRITICAL BUG found (map/population corruption after export/import), handed
off to the coder and FIXED, Tester PASSED (see "Completed rounds").
`TASKS_ARCHIVE.md#phase-xi--broad-health-sweep-archive`.

## Phase XI — Continuous Improvement (open-ended, never closes)
The PM selects and advances valuable improvements at its own discretion,
unless a new instruction comes from the user.

### Candidate direction pool (the PM picks from here each round, or generates a new idea)
- **`savegame.ts`'s `SAVE_KEY` carries the old name (Phase XXIII,
  2026-09-13)**: `"evrimsel-gezegen-save-v8"` — **Decision (PM 31): WILL
  NOT BE CHANGED** (the risk is asymmetric, silently breaking existing
  saves isn't worth a cosmetic name change). Low priority, details in
  `TASKS_ARCHIVE.md#faz-xxiii`.
- New organ/behavior ideas (when the user wants them).
- General performance/integration re-audit (can be repeated periodically,
  last done 2026-09-09 — result: the existing code is already optimized).
- Spatial partitioning (grid/quadtree): the `updateSexualReproduction` part
  is **COMPLETE, Tester PASSED**. `findNearestPrey`/`findNearestThreat`/
  `packHuntEscapeReduction` were DELIBERATELY left OUT OF SCOPE (due to
  mid-frame mutation risk) — should only be reconsidered if there's a
  noticeable performance complaint and a safe approach is found (e.g., a
  two-pass grid before/after movement).
- **Low-priority accessibility observations** (tester 62, found during the
  2026-09-10 ESC-close review, fix NOT REQUESTED — informational only): (1)
  clicking canvas-based lineage-tree nodes is not keyboard-accessible
  (screen reader/keyboard-only users can't reach the nodes) — the project
  doesn't claim WCAG compliance anywhere, this is an existing/pre-existing
  limitation; (2) the zoom buttons (`lineage-zoom-*`) have a `title` but no
  `aria-label` (close buttons have both) — a minor inconsistency, optional.
- **`npm audit` — medium-severity dev-server security warning** (tester 62,
  2026-09-10 config/dependency scan, AWAITING APPROVAL): `esbuild <=0.24.2`
  (a transitive dependency of vite@5.4.21, dev-time tooling only, doesn't
  end up in `dist/`) — GHSA-67mh-4wv8-2f99: while the dev server is
  running, any website can send it a request and read the response.
  Doesn't leak into the prod build/API key, but the fix (`npm audit fix
  --force`) requires a major framework version jump (vite@5→8, breaking
  change risk) — falls under EMIR.md's "architectural change, not made
  while the user is away" category, should not be applied without
  user/PM approval.

### Completed rounds (chronological, 2026-09-03—11)
All details are in `TASKS_ARCHIVE.md`'s "Phase XI — Completed rounds" and
"Cleanup Note" sections — Gemini end-to-end verification, dead-code
sweeps, full user-flow walkthrough, mobile/responsive CSS fix, world-event/
organ-description/import bug fixes, lineage-tree zoom/pan + full-page,
multi-save-slot (added then removed), project-root file-remnant sweep — all
COMPLETE, independent tester PASSED.

## Process Note (PM, 2026-09-01)
Running coder/tester (or coder/coder) tasks in PARALLEL causes conflicts on
the same files, leading to temporary errors (observed several times —
testers correctly identified this and compensated by re-testing on the
clean code, but it's risky). From now on: while a coder is working on a
phase, another coder/tester will run SEQUENTIALLY on the same codebase, not
dispatched in parallel.

## Roles
- **Coder**: implementation per phase (managed as a subagent, session-only).
- **Tester**: independent verification at the end of each phase (managed as
  a subagent).
- **PM** (this session): task distribution, prioritization, communication
  with the user, accept/reject decisions, continuous automatic progress via
  cron.
