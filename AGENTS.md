<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Skills

This repo ships agent skills under `.cursor/skills/`. Each subfolder contains a `SKILL.md` that describes when to use it. Read the relevant `SKILL.md` before starting tasks that match its trigger conditions.

High-value skills for most tasks:

- `brainstorming/` — before any new feature or behavior change, explore intent and design first.
- `writing-plans/` — for multi-step work, write a plan before touching code.
- `test-driven-development/` — write failing tests first, then implement.
- `systematic-debugging/` — for any bug, test failure, or unexpected behavior.
- `verification-before-completion/` — run verification commands and confirm output before claiming work is done.
- `requesting-code-review/` — before merging or completing major work.

## Cursor Cloud specific instructions

- The cloud VM only sees what's pushed to `origin/main` (or whatever branch the agent is started from). Uncommitted local changes on the user's laptop are NOT available.
- Secrets live as env vars injected by the Cloud Agent environment — read them from `process.env`, never expect a real `.env.local` file to be present.
- Run `npm install` is configured as the update script; assume node_modules may need a fresh install on cold starts.
- Always commit work to a branch and open a PR — don't push directly to `main`.
