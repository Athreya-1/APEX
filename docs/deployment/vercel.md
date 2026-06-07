# Deploying APEX on Vercel

## Project settings

| Setting | Value |
|---------|-------|
| Repository | `Athreya-1/APEX` |
| Framework | Next.js (auto-detected) |
| Root Directory | `./` |
| Build Command | `npm run build` (default) |
| Output | Next.js default |

## Environment variables

Copy `.env.example` and fill in values from your local `.env.local`. Add each variable in **Vercel → Project → Settings → Environment Variables** for Production (and Preview if you use preview deploys).

**Critical:** After the first deploy, set `NEXT_PUBLIC_APP_URL` to your actual Vercel URL (e.g. `https://apex.vercel.app`) and redeploy.

## Supabase configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

1. **Site URL:** `https://<your-vercel-domain>`
2. **Redirect URLs:** add `https://<your-vercel-domain>/auth/callback`

For Google OAuth (if enabled), ensure the Google Cloud Console authorized redirect URI matches Supabase's callback URL.

## Post-deploy verification

Run these checks after deploy:

```bash
# Login page loads
curl -s -o /dev/null -w "%{http_code}" https://<your-vercel-domain>/login
# Expected: 200

# Protected route redirects unauthenticated users
curl -s -o /dev/null -w "%{redirect_url}" https://<your-vercel-domain>/home
# Expected: redirect to /login

# Auth callback handles missing code
curl -s -o /dev/null -w "%{redirect_url}" https://<your-vercel-domain>/auth/callback
# Expected: redirect to /login?error=no_code
```

Manual checks:

- [ ] Sign in with Google redirects back to `/home` or `/onboarding`
- [ ] AI quick-add works (requires `ANTHROPIC_API_KEY`)
- [ ] Plan generation works (requires Supabase + service role key)

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Build fails on TypeScript | Fix errors locally with `npm run build` before pushing |
| OAuth redirect loop | Wrong `NEXT_PUBLIC_APP_URL` or missing Supabase redirect URL |
| AI routes return 503 | `ANTHROPIC_API_KEY` not set in Vercel |
| Auth works locally but not on Vercel | Supabase redirect URLs don't include production domain |
| Middleware redirect on every page | Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

## Branch note

Vercel deploys from `main` by default. Ensure build fixes and env var docs are merged to `main` before expecting production to match your latest local work on feature branches.
