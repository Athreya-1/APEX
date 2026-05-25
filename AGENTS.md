<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Project overview

APEX is a Next.js 16 (React 19) AI academic productivity app. It is a single monolithic Next.js application (frontend + API routes) with external dependencies on Supabase (auth + DB) and Anthropic (AI features).

### Running the app

- `npm run dev` — starts the dev server on port 3000 (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint (note: there are pre-existing lint warnings/errors in the repo)
- `npm test` — Jest tests (21 suites, 97 tests)

### Environment variables

A `.env.local` file is required at the repo root with at minimum:
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
ANTHROPIC_API_KEY=<your-key>
```
Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`

### Key notes

- Auth-protected routes (`/home`, `/tasks`, `/plan`, etc.) redirect (307) to `/login` without a valid Supabase session.
- The app uses Google OAuth via Supabase for authentication — the login page shows "Continue with Google."
- No Docker, Redis, or background workers needed — just `npm run dev`.
- Tests are fully self-contained (mocked) and do not require real Supabase/Anthropic credentials.
