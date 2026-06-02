import type { TaskTypeTag } from '@/types'
import type { QuickAddResult } from './schemas'

export interface LocalParseOpts {
  now: string // ISO, for deterministic relative-date resolution (UTC)
  knownCourses?: string[]
}

const TYPE_KEYWORDS: Array<[RegExp, TaskTypeTag]> = [
  [/\b(midterm|final)\b/i, 'exam'],
  [/\bexam\b/i, 'exam'],
  [/\blab\b/i, 'lab'],
  [/\b(p-?set)\b/i, 'pset'],
  [/\bproject\b/i, 'project'],
  [/\b(write-?up)\b/i, 'writeup'],
  [/\bquiz\b/i, 'quiz'],
  [/\breview\b/i, 'review'],
  [/\b(reading|read)\b/i, 'reading'],
]

const COURSE_LIKE: ReadonlySet<TaskTypeTag> = new Set<TaskTypeTag>(['lab', 'pset', 'quiz', 'exam'])

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

export function parseQuickAddLocal(input: string, opts: LocalParseOpts): QuickAddResult {
  let working = input

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

  // Course: explicit /token wins; else a known-course name match.
  let courseCode: string | null = null
  const slash = working.match(/(?:^|\s)\/([A-Za-z0-9-]+)/)
  if (slash) {
    courseCode = slash[1]
    working = working.replace(slash[0], ' ')
  } else if (opts.knownCourses) {
    const found = opts.knownCourses.find((c) => input.toLowerCase().includes(c.toLowerCase()))
    if (found) {
      courseCode = found
      working = working.replace(new RegExp(found, 'i'), ' ')
    }
  }

  // Task type.
  let taskType: TaskTypeTag = 'other'
  for (const [re, type] of TYPE_KEYWORDS) {
    if (re.test(input)) { taskType = type; break }
  }

  const dueDate = resolveDue(input, opts.now)

  const title = stripDatePhrases(working).replace(/\s+/g, ' ').trim() || input.trim()

  let confidence = 0.5
  if (courseCode) confidence += 0.2
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

  return { kind: 'task', title, courseCode, taskType, dueDate, doDate: null, estimateHours, confidence }
}
