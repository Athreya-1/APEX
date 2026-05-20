// src/lib/canvas/sync.ts

export interface CanvasAssignment {
  id: number
  name: string
  due_at: string | null
  points_possible: number | null
  description: string | null
  submission_types: string[]
  workflow_state: string
  course_id: number
  course_name?: string
}

export interface SyncResult {
  assignments_found: number
  assignments_new: number
  assignments_updated: number
  courses_synced: string[]
  errors: Array<{ course_id?: number; message: string }>
}

/**
 * Simple string similarity (Sørensen–Dice coefficient).
 * Returns 0–1 where 1 is identical.
 */
function stringSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>()
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.slice(i, i + 2)
      bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1)
    }
    return bigrams
  }

  const aBigrams = getBigrams(na)
  const bBigrams = getBigrams(nb)
  let intersectionSize = 0

  for (const [bigram, count] of aBigrams) {
    const bCount = bBigrams.get(bigram) ?? 0
    intersectionSize += Math.min(count, bCount)
  }

  return (2.0 * intersectionSize) / (na.length + nb.length - 2)
}

/**
 * Match an assignment's course name against the user's registered courses.
 * Returns the best match and its confidence score.
 */
export function matchCourse(
  assignmentCourseName: string,
  userCourses: Array<{ id: string; name: string; display_name: string | null }>,
): { course: (typeof userCourses)[number] | null; confidence: number } {
  let bestMatch = null
  let bestScore = 0

  for (const course of userCourses) {
    const score = Math.max(
      stringSimilarity(assignmentCourseName, course.name),
      stringSimilarity(assignmentCourseName, course.display_name ?? ''),
    )
    if (score > bestScore) {
      bestScore = score
      bestMatch = course
    }
  }

  return { course: bestScore > 0.4 ? bestMatch : null, confidence: bestScore }
}

/**
 * Determine task_type_tag from assignment name using keyword matching.
 */
export function classifyTaskType(name: string): string {
  const lower = name.toLowerCase()
  if (/\blab\b/.test(lower)) return 'lab'
  if (/\b(pset|problem.?set|hw\d|homework)\b/.test(lower)) return 'pset'
  if (/\bread(ing)?\b/.test(lower)) return 'reading'
  if (/\b(project|capstone|mini.?project)\b/.test(lower)) return 'project'
  if (/\b(writeup|write.?up|report|essay)\b/.test(lower)) return 'writeup'
  if (/\bquiz\b/.test(lower)) return 'quiz'
  if (/\b(midterm|final|exam)\b/.test(lower)) return 'exam'
  if (/\b(review|prep)\b/.test(lower)) return 'review'
  return 'other'
}

/**
 * Fetch active courses from Canvas for a user.
 */
export async function fetchCanvasCourses(
  apiToken: string,
  domain: string,
): Promise<Array<{ id: number; name: string; course_code: string }>> {
  const BASE = `https://${domain}/api/v1`
  const headers = { Authorization: `Bearer ${apiToken}` }

  const res = await fetch(
    `${BASE}/courses?enrollment_state=active&per_page=50`,
    { headers },
  )
  if (!res.ok) throw new Error(`Canvas courses fetch failed: ${res.status}`)
  return res.json()
}

/**
 * Fetch assignments for a specific Canvas course.
 */
export async function fetchCanvasAssignments(
  apiToken: string,
  domain: string,
  courseId: number,
  courseName: string,
): Promise<CanvasAssignment[]> {
  const BASE = `https://${domain}/api/v1`
  const headers = { Authorization: `Bearer ${apiToken}` }

  const res = await fetch(
    `${BASE}/courses/${courseId}/assignments?per_page=100&order_by=due_at`,
    { headers },
  )
  if (!res.ok) return []
  const assignments: CanvasAssignment[] = await res.json()
  return assignments
    .filter((a) => a.workflow_state === 'published')
    .map((a) => ({ ...a, course_name: courseName }))
}
