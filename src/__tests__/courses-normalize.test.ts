import { courseDisplayName, courseIdentityKey, dedupeCourses, isLegacySeedCourse } from '@/lib/courses/normalize'

describe('course normalize', () => {
  it('dedupes by normalized name', () => {
    const out = dedupeCourses([
      { id: 'a', name: 'Computer Systems', code: null },
      { id: 'b', name: 'Computer Systems', code: null },
      { id: 'c', name: 'NEXUS', code: null },
    ])
    expect(out).toHaveLength(2)
    expect(out.map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('builds display name without doubling code', () => {
    expect(courseDisplayName({ name: 'Intro to computer systems', code: '18-213' }))
      .toBe('18-213 Intro to computer systems')
    expect(courseDisplayName({ name: '18-213 Intro to computer systems', code: '18-213' }))
      .toBe('18-213 Intro to computer systems')
  })

  it('identity key includes code when present', () => {
    expect(courseIdentityKey('Systems', '15-213')).toBe('15-213|systems')
    expect(courseIdentityKey('Systems', '')).toBe('systems')
  })

  it('flags legacy seed demo courses', () => {
    expect(isLegacySeedCourse({ name: 'Intro to Computer Systems', code: '15-213' })).toBe(true)
    expect(isLegacySeedCourse({ name: 'Introduction to Computer Systems', code: '15-213' })).toBe(true)
    expect(isLegacySeedCourse({ name: 'Intro to computer systems', code: '18-213' })).toBe(false)
    expect(isLegacySeedCourse({ name: 'Logic & Computation', code: '18-240' })).toBe(true)
  })
})
