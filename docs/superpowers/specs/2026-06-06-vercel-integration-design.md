# Vercel Integration Verification — Design Spec

**Date:** 2026-06-06  
**Status:** Approved for implementation

## Goal

Verify that APEX deploys cleanly to Vercel and that production runtime behavior matches local dev for auth, middleware, and API routes.

## Scope

| In scope | Out of scope |
|----------|--------------|
| Build succeeds on Vercel (`next build`) | Google Calendar OAuth app registration |
| Required env vars documented | Supabase schema migrations |
| Auth redirect flow (`/login` → `/auth/callback`) | Full E2E browser automation |
| Middleware (proxy) session handling | Custom domain / DNS |
| Smoke-check of public routes | Load testing |

## Architecture

- **Repo:** `Athreya-1/APEX` — git root is the Next.js app (root directory `./` on Vercel).
- **Framework:** Next.js 16 with App Router; middleware in `src/proxy.ts`.
- **Auth:** Supabase SSR (`@supabase/ssr`); OAuth callback at `/auth/callback`.
- **Secrets:** Injected via Vercel Environment Variables (never committed).

## Required Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | Client-side Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | Server-side admin operations |
| `ANTHROPIC_API_KEY` | Production, Preview | AI routes |
| `NEXT_PUBLIC_APP_URL` | Production, Preview, Development | OAuth redirect base (must match deployed URL) |
| `GOOGLE_CLIENT_ID` | Production, Preview | Optional — Google Calendar |
| `GOOGLE_CLIENT_SECRET` | Production, Preview | Optional — Google Calendar |

## External Configuration (manual)

1. **Supabase → Authentication → URL Configuration**
   - Site URL: `https://<vercel-domain>`
   - Redirect URLs: `https://<vercel-domain>/auth/callback`

2. **Vercel → Project → Environment Variables**
   - Copy values from local `.env.local`
   - Set `NEXT_PUBLIC_APP_URL` to the Vercel production URL after first deploy

## Verification Checklist

1. `npm run build` passes locally (mirrors Vercel build)
2. `npm test` passes (206+ tests)
3. `.env.example` documents all required vars
4. Production smoke (after deploy):
   - `GET /login` returns 200
   - Unauthenticated `GET /home` redirects to `/login`
   - `GET /auth/callback` without code redirects to `/login?error=no_code`

## Branch Strategy

- Vercel initial setup targets `main` branch.
- Feature branch (`feat/apex-v1-planner`) contains newer code; merge or cherry-pick build fixes before expecting full app parity on production.

## Risks

| Risk | Mitigation |
|------|------------|
| Missing env vars → 503 on AI routes, auth failures | `.env.example` + Vercel dashboard checklist |
| Wrong `NEXT_PUBLIC_APP_URL` → OAuth loop | Update after first deploy; document in checklist |
| TypeScript build failure on feature branch | Fix `as const` on ternaries in onboarding |
| Tests fail due to timezone or missing env mock | Fix test setup, not production code |
