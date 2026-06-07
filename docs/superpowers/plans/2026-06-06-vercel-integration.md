# Vercel Integration Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify APEX is Vercel-ready: build passes, tests pass, env vars documented, deployment checklist complete.

**Architecture:** Local verification mirrors Vercel (`npm run build`). Document env vars in `.env.example`. Fix any test/build blockers on the current branch.

**Tech Stack:** Next.js 16, Supabase SSR, Vercel Hobby

---

### Task 1: Fix TypeScript build blocker

**Files:**
- Modify: `src/app/(auth)/onboarding/page.tsx:440,447`

- [x] Replace invalid `as const` on ternaries with typed assertions (`Habit['target_frequency']`, `Habit['frequency_type']`)
- [x] Run `npm run build` — expect exit 0

### Task 2: Fix failing tests

**Files:**
- Modify: `src/__tests__/HabitComponents.test.tsx`
- Modify: `src/__tests__/api-ai.test.ts`

- [ ] **HabitComponents:** Use `format(new Date(), 'yyyy-MM-dd')` for `logged_date` (timezone-safe)
- [ ] **api-ai:** Set `process.env.ANTHROPIC_API_KEY = 'test-key'` in test setup
- [ ] Run `npm test` — expect 0 failures

### Task 3: Add deployment documentation

**Files:**
- Create: `.env.example`
- Create: `docs/deployment/vercel.md`

- [ ] Add all required env var names with comments (no secret values)
- [ ] Write step-by-step Vercel + Supabase configuration checklist

### Task 4: Full verification run

- [ ] `npm run build` — exit 0
- [ ] `npm test` — exit 0, 0 failures
- [ ] `npm run lint` — exit 0 (if no pre-existing failures, note them)

### Task 5: Production smoke (if deployed)

- [ ] Fetch `https://<vercel-url>/login` — status 200
- [ ] Fetch `https://<vercel-url>/home` — redirect to `/login`
- [ ] Document deployed URL and any env gaps found
