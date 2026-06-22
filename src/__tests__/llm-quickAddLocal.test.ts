import { parseQuickAddLocal } from '@/lib/llm/quickAddLocal'

const NOW = '2026-06-01T12:00:00.000Z' // Monday

describe('parseQuickAddLocal', () => {
  it('parses course, type, duration, and a bare title', () => {
    const r = parseQuickAddLocal('15-213 lab 3 /213 4h', { now: NOW })
    if (r.kind !== 'task') throw new Error('expected task')
    expect(r.courseCode).toBe('213')
    expect(r.taskType).toBe('lab')
    expect(r.estimateHours).toBe(4)
    expect(r.title.toLowerCase()).toContain('lab')
  })
  it('resolves "next week" to +7 days at 23:59', () => {
    const r = parseQuickAddLocal('reading /history next week 90m', { now: NOW })
    if (r.kind !== 'task') throw new Error('expected task')
    expect(r.dueDate).toBe('2026-06-08T23:59:00.000Z')
    expect(r.estimateHours).toBe(1.5)
  })
  it('resolves "in 3 days"', () => {
    const r = parseQuickAddLocal('project /xyz in 3 days', { now: NOW })
    if (r.kind !== 'task') throw new Error('expected task')
    expect(r.dueDate).toBe('2026-06-04T23:59:00.000Z')
  })
  it('asks for the course when a graded type lacks one', () => {
    const r = parseQuickAddLocal('lab 4 tomorrow', { now: NOW })
    expect(r.kind).toBe('clarify')
    if (r.kind === 'clarify') expect(r.missingFields).toContain('courseCode')
  })
  it('matches shorthand 213 against registered course code', () => {
    const r = parseQuickAddLocal('213 lab 5 due thu', {
      now: NOW,
      courses: [{ id: 'c1', name: 'Introduction to Computer Systems', code: '18-213' }],
    })
    if (r.kind !== 'task') throw new Error('expected task')
    expect(r.courseCode).toBe('18-213')
    expect(r.taskType).toBe('lab')
    expect(r.resolvedCourseId).toBe('c1')
  })
  it('clarifies when shorthand matches multiple courses', () => {
    const r = parseQuickAddLocal('213 lab 4 tomorrow', {
      now: NOW,
      courses: [
        { id: 'c1', name: 'Intro to Computer Systems', code: '15-213' },
        { id: 'c2', name: 'Introduction to Computer Systems', code: '18-213' },
      ],
    })
    expect(r.kind).toBe('clarify')
    if (r.kind === 'clarify') {
      expect(r.courseCandidates).toHaveLength(2)
      expect(r.missingFields).toContain('courseCode')
    }
  })
  it('matches a known course by name', () => {
    const r = parseQuickAddLocal('finish CMR writeup tomorrow', { now: NOW, knownCourses: ['CMR'] })
    if (r.kind !== 'task') throw new Error('expected task')
    expect(r.courseCode).toBe('CMR')
    expect(r.taskType).toBe('writeup')
  })
})
