/** @jest-environment node */
import { matchCourse, classifyTaskType } from '@/lib/canvas/sync'

const courses = [
  { id: 'c1', name: '15-213', display_name: 'Intro to Systems' },
  { id: 'c2', name: 'CMR', display_name: 'Carnegie Mellon Racing' },
]

describe('Canvas sync utilities', () => {
  it('matches exact course name with high confidence', () => {
    const { course, confidence } = matchCourse('15-213', courses)
    expect(course?.id).toBe('c1')
    expect(confidence).toBeGreaterThan(0.7)
  })

  it('matches display name', () => {
    const { course, confidence } = matchCourse('Intro to Systems', courses)
    expect(course?.id).toBe('c1')
    expect(confidence).toBeGreaterThan(0.5)
  })

  it('returns null for no match', () => {
    const { course } = matchCourse('xyzzy123', courses)
    expect(course).toBeNull()
  })

  it('classifies lab correctly', () => {
    expect(classifyTaskType('Lab 4 — Cache Simulator')).toBe('lab')
  })

  it('classifies pset correctly', () => {
    expect(classifyTaskType('HW2 - Problem Set')).toBe('pset')
  })

  it('classifies reading correctly', () => {
    expect(classifyTaskType('Reading 5 - Chapter 3')).toBe('reading')
  })

  it('classifies project for Final Project Demo', () => {
    expect(classifyTaskType('Final Project Demo')).toBe('project')
  })
})
