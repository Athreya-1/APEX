import type { TaskTypeTag } from '@/types'

export interface TaskTypeRule {
  type: TaskTypeTag
  /** Word-boundary regex source; use \\s for phrases */
  pattern: RegExp
  /** Higher priority wins when multiple rules match */
  priority: number
}

/**
 * Priority tiers:
 * 100 — multi-word phrases & unambiguous exam terms
 *  90 — specific compound types (lab report, pop quiz)
 *  80 — primary category keywords
 *  70 — common abbreviations & synonyms
 *  60 — loose / contextual synonyms
 */
export const TASK_TYPE_RULES: TaskTypeRule[] = [
  // ── Exam (highest specificity first) ─────────────────────────────────────
  { type: 'exam', pattern: /\b(midterm\s+exam|final\s+exam|comprehensive\s+final)\b/i, priority: 100 },
  { type: 'project', pattern: /\b(final\s+project|capstone\s+project|group\s+project|team\s+project|senior\s+project)\b/i, priority: 99 },
  { type: 'review', pattern: /\b(study\s+guide|exam\s+prep|test\s+prep|review\s+session)\b/i, priority: 98 },
  { type: 'exam', pattern: /\b(midterm|finals?)(?!\s+project)\b/i, priority: 97 },
  { type: 'review', pattern: /\b(?:cram|study|studying|prep|prepare)\b.{0,40}\btest\b/i, priority: 96 },
  { type: 'review', pattern: /\b(practice\s+exam|practice\s+test|mock\s+exam|mock\s+test|old\s+exams?)\b/i, priority: 96 },
  { type: 'exam', pattern: /\b(exam|examination|proctored\s+test)\b/i, priority: 90 },
  { type: 'exam', pattern: /\b(test)(?!\s+(prep|review|practice))\b/i, priority: 75 },

  // ── Quiz ───────────────────────────────────────────────────────────────────
  { type: 'quiz', pattern: /\b(pop\s*quiz|pop-quiz|in-class\s+quiz|clicker\s+quiz)\b/i, priority: 95 },
  { type: 'quiz', pattern: /\b(quiz|quizzes|checkpoint\s+quiz|weekly\s+quiz)\b/i, priority: 85 },
  { type: 'quiz', pattern: /\b(clicker|i-clicker|iclicker)\b/i, priority: 70 },

  // ── Lab ──────────────────────────────────────────────────────────────────
  { type: 'writeup', pattern: /\b((?<!pre-)(?<!post-)lab\s+report|(?<!pre-)(?<!post-)lab\s+write-?up|experiment\s+report)\b/i, priority: 94 },
  { type: 'lab', pattern: /\b(pre-?lab|post-?lab|prelab|postlab)\b/i, priority: 92 },
  { type: 'lab', pattern: /\b(lab|labs|laboratory|labwork|lab\s+work)\b/i, priority: 88 },
  { type: 'lab', pattern: /\b(experiment|experiments|titration|dissection|simulation\s+lab|bench\s+work)\b/i, priority: 72 },

  // ── Problem set / homework ───────────────────────────────────────────────
  { type: 'pset', pattern: /\b(problem\s+set|problemset|p-?\s*set|pset)\b/i, priority: 93 },
  { type: 'pset', pattern: /\b(homework|home\s*work|hw|hmwk|homewrk)\b/i, priority: 87 },
  { type: 'pset', pattern: /\b(assignment|assignments|worksheet|worksheets)\b/i, priority: 82 },
  { type: 'pset', pattern: /\b(exercise\s+set|exercises|challenge\s+problems?|drill|drills|problem\s+\d+|problems\s+\d+)\b/i, priority: 78 },
  { type: 'pset', pattern: /\b(assign\.?|assn\.?|ps\d+)\b/i, priority: 68 },

  // ── Write-up / reports ───────────────────────────────────────────────────
  { type: 'writeup', pattern: /\b(write-?up|write\s+up|written\s+report)\b/i, priority: 91 },
  { type: 'writeup', pattern: /\b(essay|term\s+paper|research\s+paper|response\s+paper|analysis\s+paper|reflection\s+paper)\b/i, priority: 89 },
  { type: 'writeup', pattern: /\b(report|reports|memo|memorandum|documentation|readme)\b/i, priority: 81 },
  { type: 'writeup', pattern: /\b(reflection|reflections|summary\s+write|discussion\s+post|discussion\s+board|db\s+post)\b/i, priority: 77 },
  { type: 'writeup', pattern: /\b(post-?mortem|postmortem|design\s+doc|tech\s+report|white\s+paper)\b/i, priority: 76 },
  { type: 'writeup', pattern: /\b(paper)(?!\s*(review|reading))\b/i, priority: 74 },

  // ── Reading ──────────────────────────────────────────────────────────────
  { type: 'reading', pattern: /\b(reading\s+assignment|assigned\s+reading|required\s+reading)\b/i, priority: 94 },
  { type: 'reading', pattern: /\b(read|reading|skim|skimming|annotate|annotation|annotations)\b/i, priority: 86 },
  { type: 'reading', pattern: /\b(chapter|chapters|ch\.?|sections?|textbook|journal\s+article)\b/i, priority: 80 },
  { type: 'reading', pattern: /\b(pages?|pgs?|pp\.?|pg\.?)\b/i, priority: 73 },
  { type: 'reading', pattern: /\b(article|articles|passage|case\s+study\s+read)\b/i, priority: 71 },

  // ── Project ──────────────────────────────────────────────────────────────
  { type: 'project', pattern: /\b(final\s+project|capstone|milestone|milestones|deliverable|deliverables)\b/i, priority: 90 },
  { type: 'project', pattern: /\b(project|projects|proj\.?)\b/i, priority: 84 },
  { type: 'project', pattern: /\b(prototype|prototypes|implementation|build\s+out|sprint|hackathon)\b/i, priority: 72 },
  { type: 'project', pattern: /\b(group\s+work|team\s+assignment|team\s+deliverable)\b/i, priority: 70 },

  // ── Review / study ───────────────────────────────────────────────────────
  { type: 'review', pattern: /\b(practice\s+problems?|practice\s+questions?|recitation\s+prep)\b/i, priority: 88 },
  { type: 'review', pattern: /\b(review|reviews|reviewing|revise|revision|revisions)\b/i, priority: 92 },
  { type: 'review', pattern: /\b(study|studying|prep|prepare|preparation|recap|recitation)\b/i, priority: 79 },
  { type: 'review', pattern: /\b(cram|cramming|flashcards?|anki|go\s+over|brush\s+up|outline|cheat\s+sheet)\b/i, priority: 71 },
  { type: 'review', pattern: /\b(notes\s+review|lecture\s+review|slides\s+review)\b/i, priority: 69 },
]

/** Task types that require a course when none is detected */
export const COURSE_LIKE_TASK_TYPES: ReadonlySet<TaskTypeTag> = new Set<TaskTypeTag>([
  'lab', 'pset', 'quiz', 'exam',
])

export interface TaskTypeMatch {
  type: TaskTypeTag
  priority: number
  matchedText: string
}

const SORTED_RULES = [...TASK_TYPE_RULES].sort((a, b) => b.priority - a.priority)

/**
 * Resolve the best-matching task type from freeform quick-add text.
 * Returns `other` when no alias matches.
 */
export function resolveTaskTypeFromText(input: string): TaskTypeTag {
  return resolveTaskTypeMatch(input)?.type ?? 'other'
}

/** Full match detail — useful for tests and debugging */
export function resolveTaskTypeMatch(input: string): TaskTypeMatch | null {
  if (!input.trim()) return null

  let best: TaskTypeMatch | null = null
  for (const { type, pattern, priority } of SORTED_RULES) {
    const m = input.match(pattern)
    if (!m) continue
    if (!best || priority > best.priority) {
      best = { type, priority, matchedText: m[0] }
    }
  }
  return best
}

/** All aliases for a type (for docs / future UI hints) */
export function aliasesForTaskType(type: TaskTypeTag): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const rule of TASK_TYPE_RULES) {
    if (rule.type !== type) continue
    const src = rule.pattern.source
      .replace(/\\b/g, '')
      .replace(/\\s\+/g, ' ')
      .replace(/\\s\*/g, '')
      .replace(/[()?^$[\]|]/g, '')
      .split('|')
    for (const part of src) {
      const key = part.trim().toLowerCase()
      if (key && !seen.has(key)) {
        seen.add(key)
        out.push(key)
      }
    }
  }
  return out
}
