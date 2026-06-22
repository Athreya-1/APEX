import { matchCourseFromText, type CourseForMatch } from '@/lib/courses/match-from-text'

const ICS: CourseForMatch = {
  id: 'c1',
  name: 'Introduction to Computer Systems',
  code: '18-213',
}

const ALGO: CourseForMatch = {
  id: 'c2',
  name: 'Great Ideas in CS',
  code: '15-251',
}

const ICS_LEGACY: CourseForMatch = {
  id: 'c3',
  name: 'Intro to Computer Systems',
  code: '15-213',
}

describe('matchCourseFromText', () => {
  it('matches shorthand course number 213', () => {
    const r = matchCourseFromText('213 lab 5 due thu', [ICS])
    expect(r.kind).toBe('match')
    if (r.kind === 'match') {
      expect(r.course.id).toBe('c1')
      expect(r.remainingText.toLowerCase()).toContain('lab')
    }
  })

  it('matches full course code in text', () => {
    const r = matchCourseFromText('18-213 pset 3 tomorrow', [ICS])
    expect(r.kind).toBe('match')
    if (r.kind === 'match') expect(r.course.code).toBe('18-213')
  })

  it('matches significant name token', () => {
    const r = matchCourseFromText('systems reading 2h', [ICS])
    expect(r.kind).toBe('match')
    if (r.kind === 'match') expect(r.course.id).toBe('c1')
  })

  it('returns none when no course signal', () => {
    const r = matchCourseFromText('buy groceries', [ICS, ALGO])
    expect(r.kind).toBe('none')
  })

  it('returns ambiguous when shorthand matches multiple courses', () => {
    const r = matchCourseFromText('213 lab 4 tomorrow', [ICS, ICS_LEGACY])
    expect(r.kind).toBe('ambiguous')
    if (r.kind === 'ambiguous') {
      expect(r.candidates).toHaveLength(2)
      expect(r.matchedToken).toBe('213')
    }
  })

  it('prefers exact code over ambiguous suffix', () => {
    const r = matchCourseFromText('18-213 lab 4 tomorrow', [ICS, ICS_LEGACY])
    expect(r.kind).toBe('match')
    if (r.kind === 'match') expect(r.course.id).toBe('c1')
  })
})
