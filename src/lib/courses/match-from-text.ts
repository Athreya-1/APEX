import { courseDisplayName } from '@/lib/courses/normalize'

export interface CourseForMatch {
  id: string
  name: string
  code?: string | null
}

export type CourseMatchResult =
  | {
      kind: 'match'
      course: CourseForMatch
      matchedText: string
      remainingText: string
      confidence: number
    }
  | {
      kind: 'ambiguous'
      candidates: CourseForMatch[]
      matchedToken: string
    }
  | { kind: 'none' }

interface AliasEntry {
  course: CourseForMatch
  alias: string
  weight: number
}

const MIN_TOKEN_ALIAS_LEN = 3
const MIN_NAME_TOKEN_LEN = 4
const MATCH_THRESHOLD = 0.6

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildAliases(course: CourseForMatch): AliasEntry[] {
  const entries: AliasEntry[] = []
  const code = (course.code ?? '').trim()
  const name = course.name.trim()

  if (code) {
    const codeLc = code.toLowerCase()
    entries.push({ course, alias: codeLc, weight: 1.0 })
    const suffix = code.split('-').pop()
    if (suffix && suffix !== code && /^\d{2,}$/.test(suffix)) {
      entries.push({ course, alias: suffix.toLowerCase(), weight: 0.85 })
    }
  }

  const display = courseDisplayName(course).toLowerCase()
  if (display) entries.push({ course, alias: display, weight: 0.9 })

  for (const token of name.toLowerCase().split(/\s+/)) {
    if (token.length >= MIN_NAME_TOKEN_LEN) {
      entries.push({ course, alias: token, weight: 0.65 })
    }
  }

  return entries
}

interface ScoredHit {
  course: CourseForMatch
  alias: string
  matchedText: string
  score: number
}

function tokenize(input: string): string[] {
  return input.toLowerCase().split(/[\s,/]+/).filter(Boolean)
}

function hasWordBoundary(text: string, alias: string): boolean {
  return new RegExp(`(?:^|[\\s,/])${escapeRegex(alias)}(?:[\\s,/]|$)`, 'i').test(text)
}

function removeMatch(text: string, matched: string): string {
  const re = new RegExp(`(?:^|[\\s,/])${escapeRegex(matched)}(?=[\\s,/]|$)`, 'i')
  return text.replace(re, ' ').replace(/\s+/g, ' ').trim()
}

export function matchCourseFromText(input: string, courses: CourseForMatch[]): CourseMatchResult {
  if (!courses.length || !input.trim()) return { kind: 'none' }

  const aliases = courses.flatMap(buildAliases)
  const lc = input.toLowerCase()
  const tokens = tokenize(input)
  const hits: ScoredHit[] = []

  for (const { course, alias, weight } of aliases) {
    if (alias.length >= MIN_TOKEN_ALIAS_LEN && lc.includes(alias)) {
      const boundary = hasWordBoundary(input, alias)
      const score = weight + (boundary ? 0.1 : 0)
      hits.push({ course, alias, matchedText: alias, score })
    }

    for (const token of tokens) {
      if (token.length < MIN_TOKEN_ALIAS_LEN) continue
      if (token === alias) {
        hits.push({ course, alias, matchedText: token, score: weight })
      } else if (alias.length > token.length && alias.endsWith(token) && token.length >= 3) {
        hits.push({ course, alias, matchedText: token, score: weight * 0.92 })
      }
    }
  }

  if (!hits.length) return { kind: 'none' }

  const bestByCourse = new Map<string, ScoredHit>()
  for (const hit of hits) {
    const prev = bestByCourse.get(hit.course.id)
    if (!prev || hit.score > prev.score) bestByCourse.set(hit.course.id, hit)
  }

  const ranked = [...bestByCourse.values()].sort((a, b) => b.score - a.score)
  const top = ranked[0]
  if (!top || top.score < MATCH_THRESHOLD) return { kind: 'none' }

  const tied = ranked.filter((h) => Math.abs(h.score - top.score) < 0.02)
  if (tied.length > 1) {
    const token = top.matchedText
    const sameToken = tied.filter((h) => h.matchedText === token || h.alias === token)
    if (sameToken.length > 1) {
      return {
        kind: 'ambiguous',
        candidates: sameToken.map((h) => h.course),
        matchedToken: token,
      }
    }
  }

  const remainingText = removeMatch(input, top.matchedText)
  return {
    kind: 'match',
    course: top.course,
    matchedText: top.matchedText,
    remainingText,
    confidence: Math.min(1, top.score),
  }
}
