# Plan 07 — Generate / Replan API + GCal sync

> **For agentic workers:** Wire Plans 02–06 into production API routes. The LLM never emits timelines; `generatePlan` does. GCal is diff-synced (create/update/delete), not blind insert. Micro-replan shifts blocks; NL-replan re-runs the engine from `from_time`.

**Goal:** Replace Claude-timeline `api/plan/generate` with deterministic orchestration; extend `api/plan/replan` (micro shift + NL/full regen); add GCal update + diff sync; fix `router.ts` replan URL.

**New modules:**
- `src/lib/planning/orchestrator.ts` — `buildPlanRequest` (pure)
- `src/lib/planning/persist.ts` — engine blocks → DB rows (pure mapping)
- `src/lib/calendar/gcal-sync.ts` — diff + sync helpers (GCal I/O injectable in tests)

**Modified:**
- `src/lib/calendar/gcal.ts` — `updateGCalEvent`
- `src/app/api/plan/generate/route.ts` — full rewrite
- `src/app/api/plan/replan/route.ts` — micro + NL
- `src/lib/ai/router.ts` — fix replan fetch URL
