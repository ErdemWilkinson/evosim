# ORDER — Autonomous Operation Instruction (user, 2026-09-06)

**The user is away. This file is a reminder to RESTORE the project's autonomous
operation** even if the environment gets reset and cron jobs/sessions are lost.
If any Claude session (PM, coder, tester, or none) sees this file and finds
the structure below broken (no cron, roles unclear), it should RESTORE it.

## Structure: 3 separate roles, 3 separate sessions, 3 separate crons
1. **PM** — coordination, task distribution, archiving, summary for the user
   (when they return). Cron: roughly every 30 min (an offset that avoids
   minute 0/30, e.g. `17,47`).
2. **Coder** — picks up/selects tasks from TASKS.md, writes code, verifies
   with `tsc`/`build`, updates TASKS.md. Cron: roughly every 15-20 min.
3. **Tester** — tests phases the coder has completed but that are awaiting
   independent verification (doesn't write code, only reads + runs headless
   tests). Cron: roughly every 15 min.

## Critical rules (must be included in every cron prompt)
- Stopping the dev server: ONLY the process it started itself, by PID. NEVER
  `taskkill /IM node.exe` (kills all Node processes, breaking other
  sessions' work).
- The `GEMINI_API_KEY` in `.env` must NEVER leak to the client side (do not
  deviate from the existing `vite.config.ts` server-side proxy pattern).
- Multiple coders/testers must NOT run in PARALLEL on the SAME codebase at
  the same time — risk of file conflicts (this actually happened during
  Phase II/VI). Coder/tester should send each other a short message like
  "I'm touching these files."
- **Irreversible/major decisions** (deploying to a real backend, setting up
  a database, connecting to an external service, architectural changes) are
  NOT made while the user is away — only local/development-environment,
  reversible steps are taken. If unsure, consult the PM; if the PM is also
  unsure, it should hold off, leave a note, and ask the user when they
  return.
- **Git (as of 2026-09-13)**: The project is now a git repository, named
  "Evosim" (GitHub: `ErdemWilkinson/evosim`, **PUBLIC as of 2026-09-14**).
  The coder runs `git add`+`git commit` at the end of every round of code
  changes (small, descriptive messages). **`git push` is done ONLY with PM
  approval** — the coder/tester does NOT push on its own (it's a remote repo,
  and reverting is not within the coder/tester's authority).
- **CRITICAL — since the repo is PUBLIC**: The real VALUE of
  `GEMINI_API_KEY` in `.env` must NEVER be written to any file (code,
  comments, commit messages, test scripts, temporary debug files included)
  — only the `process.env.GEMINI_API_KEY` REFERENCE is used. `.env` is
  already in `.gitignore`; if a new `.env`-like/secret file is added, it
  must be added to `.gitignore` immediately. Review with `git diff --staged`
  before every commit; if you see a suspicious string, do NOT commit, ask
  the PM.

## The user's explicit request
- The project should be continuously perfected, autonomously picking and
  implementing new tasks for itself ("you'll keep trying to perfect the
  project by giving yourself new tasks").
- **Both frontend and backend** work is expected — the "Autonomous Operation
  Mode" section of TASKS.md lists backend ideas (moving the Gemini proxy to
  a real backend, a population/lineage data API, etc.).

## What a session should do if it finds this file and the structure broken
1. Read TASKS.md (current status, candidate pool).
2. Check active peer sessions with ListAgents, recall/clarify roles (if any)
   (it can ask with a short message).
3. Set up a cron suited to its own role (per the cadences above), and start
   its first round itself immediately (without waiting).
4. If a role is missing (e.g. there's no coder at all) and there's an idle
   peer session, assign it that role.

This file remains in effect until the user returns and gives different
instructions.
