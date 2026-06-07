/** Old settings-page mock rows that may have been persisted to the DB. */
const LEGACY_SEED_MATCHERS: Array<{ code: string; namePattern: RegExp }> = [
  { code: '15-213', namePattern: /intro(duction)?\s+to\s+computer\s+systems/i },
  { code: '18-240', namePattern: /logic\s*&\s*computation/i },
  { code: '15-251', namePattern: /great\s+ideas/i },
  { code: 'cmr', namePattern: /carnegie\s+mellon\s+racing/i },
]

/** True for demo courses shipped in early settings UI — not real user data. */
export function isLegacySeedCourse(course: { name: string; code?: string | null }): boolean {
  const code = (course.code ?? '').trim().toLowerCase()
  const name = course.name.trim()
  if (!name) return false
  for (const { code: seedCode, namePattern } of LEGACY_SEED_MATCHERS) {
    if (code === seedCode && namePattern.test(name)) return true
  }
  // Name-only seed row (no code column set)
  if (!code && /intro(duction)?\s+to\s+computer\s+systems/i.test(name)) return true
  return false
}

/** Stable identity for deduping courses within a user account. */
export function courseIdentityKey(name: string, code?: string | null): string {
  const n = name.trim().toLowerCase()
  const c = (code ?? '').trim().toLowerCase()
  return c ? `${c}|${n}` : n
}

/** Display label for filters/lists — avoids doubling code when already in name. */
export function courseDisplayName(course: { name: string; code?: string | null }): string {
  const name = course.name.trim()
  const code = (course.code ?? '').trim()
  if (!code) return name
  const nameLower = name.toLowerCase()
  const codeLower = code.toLowerCase()
  if (nameLower === codeLower || nameLower.startsWith(`${codeLower} `) || nameLower.includes(codeLower)) {
    return name
  }
  return `${code} ${name}`
}

export interface CourseRow {
  id: string
  name: string
  code?: string | null
  color?: string | null
  difficulty_multiplier?: number | null
}

/** Keep the oldest row per identity key (matches DB dedupe migration). */
export function dedupeCourses<T extends CourseRow>(courses: T[]): T[] {
  const seen = new Map<string, T>()
  for (const c of courses) {
    const key = courseIdentityKey(c.name, c.code)
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, c)
      continue
    }
    // Prefer row with a code if one duplicate lacks it
    if (!existing.code && c.code) {
      seen.set(key, c)
    }
  }
  return Array.from(seen.values())
}
