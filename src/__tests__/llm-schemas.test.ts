import { QuickAddResultSchema, GoalDecompositionSchema } from '@/lib/llm/schemas'

describe('schemas', () => {
  it('accepts a valid parsed task', () => {
    const r = QuickAddResultSchema.safeParse({
      kind: 'task', title: 'Lab 3', courseCode: '15-213', taskType: 'lab',
      dueDate: '2026-06-05T23:59:00.000Z', doDate: null, estimateHours: 4, confidence: 0.8,
    })
    expect(r.success).toBe(true)
  })
  it('routes clarify via discriminated union', () => {
    const r = QuickAddResultSchema.safeParse({ kind: 'clarify', question: 'Which course?', missingFields: ['courseCode'] })
    expect(r.success).toBe(true)
  })
  it('rejects invalid taskType', () => {
    const r = QuickAddResultSchema.safeParse({
      kind: 'task', title: 'x', courseCode: null, taskType: 'nope',
      dueDate: null, doDate: null, estimateHours: null, confidence: 0.5,
    })
    expect(r.success).toBe(false)
  })
  it('requires at least one habit in a decomposition', () => {
    expect(GoalDecompositionSchema.safeParse({ goalTitle: 'Get fit', habits: [] }).success).toBe(false)
  })
})
