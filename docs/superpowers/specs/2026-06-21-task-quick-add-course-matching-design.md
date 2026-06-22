# Task Quick-Add Intelligent Course Matching

**Date:** 2026-06-21  
**Status:** Approved

## Problem

Quick-add only matches course `name` via substring. Codes like `18-213` and shorthand `213` are ignored when stored separately from the title.

## Solution

Local **course alias index** with weighted token/substring scoring. No API calls for matching.

## Alias sources (per course)

- `code` (e.g. `18-213`) — weight 1.0
- Code suffix after hyphen (e.g. `213`) — weight 0.85
- Display name (`courseDisplayName`) — weight 0.9
- Significant name tokens (≥4 chars) — weight 0.65

## Matching

1. Scan full input for alias substrings and token matches
2. Best score per course; winner above 0.6 threshold wins
3. **Ambiguous** (tie on same token, e.g. `213` for both `15-213` and `18-213`) → clarify with course chips (**user chose A**)
4. Strip matched span from working text before title extraction

## API usage

- Preview: always local
- Submit: local-first; skip LLM when `kind === 'task'` and `confidence >= 0.65`, or when `kind === 'clarify'`
- LLM fallback only for low-confidence parses when `ANTHROPIC_API_KEY` is set

## Files

- `src/lib/courses/match-from-text.ts` — new
- `src/lib/llm/quickAddLocal.ts` — use matcher
- `src/app/api/tasks/quick-add/route.ts` — full courses + local-first
- `src/components/tasks/QuickAddBar.tsx` — pass course objects
- `src/app/(app)/tasks/page.tsx` — pass id/name/code
