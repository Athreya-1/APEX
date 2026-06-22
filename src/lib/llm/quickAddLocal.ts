import type { TaskTypeTag } from '@/types'
import type { QuickAddResult } from './schemas'
import { matchCourseFromText, type CourseForMatch } from '@/lib/courses/match-from-text'
import { courseDisplayName } from '@/lib/courses/normalize'
import { resolveTaskTypeFromText, COURSE_LIKE_TASK_TYPES } from '@/lib/tasks/task-type-aliases'

export interface LocalParseOpts {
  now: string // ISO, for deterministic relative-date resolution (UTC)
  /** @deprecated Use `courses` for alias-aware matching */
  knownCourses?: string[]
  courses?: CourseForMatch[]
}

const COURSE_LIKE = COURSE_LIKE_TASK_TYPES

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

function endOfDayISO(now: Date, addDays: number): string {
  const d = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + addDays, 23, 59, 0, 0,
  ))
  return d.toISOString()
}

function resolveDue(input: string, nowISO: string): string | null {
  const now = new Date(nowISO)
  const lc = input.toLowerCase()
  if (/\bnext week\b/.test(lc)) return endOfDayISO(now, 7)
  if (/\btomorrow\b/.test(lc)) return endOfDayISO(now, 1)
  if (/\btoday\b/.test(lc)) return endOfDayISO(now, 0)
  const inDays = lc.match(/\bin (\d+) days?\b/)
  if (inDays) return endOfDayISO(now, parseInt(inDays[1], 10))
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(lc)) {
      let delta = (dow - now.getUTCDay() + 7) % 7
      if (delta === 0) delta = 7
      return endOfDayISO(now, delta)
    }
  }
  return null
}

function stripDatePhrases(text: string): string {
  return text
    .replace(/\bnext week\b/gi, '')
    .replace(/\btomorrow\b/gi, '')
    .replace(/\btoday\b/gi, '')
    .replace(/\bin \d+ days?\b/gi, '')
    .replace(new RegExp(`\\b(${Object.keys(WEEKDAYS).join('|')})\\b`, 'gi'), '')
}

function legacyKnownCourses(courses: CourseForMatch[] | undefined, knownCourses: string[] | undefined): CourseForMatch[] {
  if (courses?.length) return courses
  return (knownCourses ?? []).map((name, i) => ({ id: `legacy-${i}`, name, code: null }))
}

function courseLabel(course: CourseForMatch): string {
  return course.code?.trim() || courseDisplayName(course)
}

export function parseQuickAddLocal(input: string, opts: LocalParseOpts): QuickAddResult {
  let working = input
  let courseConfidence = 0

  // Duration first (so a leading-slash duration isn't mistaken for a course token).
  let estimateHours: number | null = null
  const hours = working.match(/(\d+(?:\.\d+)?)\s*h\b/i)
  const mins = working.match(/(\d+)\s*m(?:in)?\b/i)
  if (hours) {
    estimateHours = parseFloat(hours[1])
    working = working.replace(hours[0], ' ')
  } else if (mins) {
    estimateHours = parseInt(mins[1], 10) / 60
    working = working.replace(mins[0], ' ')
  }

  const catalog = legacyKnownCourses(opts.courses, opts.knownCourses)
  let courseCode: string | null = null
  let resolvedCourseId: string | null = null

  const slash = working.match(/(?:^|\s)\/([A-Za-z0-9-]+)/)
  if (slash) {
    courseCode = slash[1]
    working = working.replace(slash[0], ' ')
    const slashMatch = matchCourseFromText(slash[1], catalog)
    if (slashMatch.kind === 'match') {
      resolvedCourseId = slashMatch.course.id
      courseCode = courseLabel(slashMatch.course)
      courseConfidence = slashMatch.confidence
    }
  } else if (catalog.length) {
    const matched = matchCourseFromText(working, catalog)
    if (matched.kind === 'match') {
      courseCode = courseLabel(matched.course)
      resolvedCourseId = matched.course.id
      working = matched.remainingText
      courseConfidence = matched.confidence
    } else if (matched.kind === 'ambiguous') {
      const taskType = resolveTaskTypeFromText(input)
      const dueDate = resolveDue(input, opts.now)
      const title = stripDatePhrases(working).replace(/\s+/g, ' ').trim() || input.trim()
      return {
        kind: 'clarify',
        question: `Which course did you mean for "${matched.matchedToken}"?`,
        missingFields: ['courseCode'],
        courseCandidates: matched.candidates.map((c) => ({
          id: c.id,
          label: courseDisplayName(c),
        })),
        partial: {
          kind: 'task',
          title,
          taskType,
          dueDate,
          doDate: null,
          estimateHours,
          confidence: 0.5,
        },
      }
    } else if (opts.knownCourses) {
      const found = opts.knownCourses.find((c) => input.toLowerCase().includes(c.toLowerCase()))
      if (found) {
        courseCode = found
        working = working.replace(new RegExp(escapeRegExp(found), 'i'), ' ')
        courseConfidence = 0.7
      }
    }
  }

  const taskType = resolveTaskTypeFromText(input)

  const dueDate = resolveDue(input, opts.now)

  const title = stripDatePhrases(working).replace(/\s+/g, ' ').trim() || input.trim()

  let confidence = 0.5
  if (courseCode) confidence += courseConfidence > 0 ? courseConfidence * 0.25 : 0.2
  if (dueDate) confidence += 0.15
  if (estimateHours != null) confidence += 0.15
  confidence = Math.min(1, confidence)

  if (!courseCode && COURSE_LIKE.has(taskType)) {
    return {
      kind: 'clarify',
      question: `Which course is this ${taskType} for?`,
      missingFields: ['courseCode'],
      partial: { kind: 'task', title, taskType, dueDate, doDate: null, estimateHours, confidence },
    }
  }

  const result = {
    kind: 'task' as const,
    title,
    courseCode,
    taskType,
    dueDate,
    doDate: null,
    estimateHours,
    confidence,
  }

  if (resolvedCourseId && !resolvedCourseId.startsWith('legacy-')) {
    return { ...result, resolvedCourseId }
  }
  return result
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
