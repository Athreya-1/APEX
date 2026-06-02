import { parseQuickAdd, decomposeGoal, explainPlan, parseReplan } from '@/lib/llm/functions'
import type { ModelCaller } from '@/lib/llm/client'

const caller = (text: string): ModelCaller => async () => text
const NOW = '2026-06-01T12:00:00.000Z'

describe('LLM functions with injected caller', () => {
  it('parseQuickAdd returns the model task when valid', async () => {
    const json = JSON.stringify({
      kind: 'task', title: 'Lab 3', courseCode: '15-213', taskType: 'lab',
      dueDate: null, doDate: null, estimateHours: 4, confidence: 0.9,
    })
    const r = await parseQuickAdd('lab 3', {}, caller(json), { now: NOW })
    expect(r.kind).toBe('task')
    if (r.kind === 'task') expect(r.courseCode).toBe('15-213')
  })
  it('parseQuickAdd falls back to local parser on bad model output', async () => {
    const r = await parseQuickAdd('15-213 lab 3 /213 4h', {}, caller('garbage not json'), { now: NOW })
    expect(r.kind).toBe('task')
    if (r.kind === 'task') expect(r.estimateHours).toBe(4)
  })
  it('decomposeGoal validates the habit list', async () => {
    const json = JSON.stringify({
      goalTitle: 'Get fit',
      habits: [{ title: 'Gym', mode: 'time_blocked', durationMins: 60, frequencyType: 'weekly', frequencyTarget: 3, cognitiveClass: 'physical', rationale: 'x' }],
    })
    const r = await decomposeGoal('I want to get fit', caller(json))
    expect(r.habits.length).toBe(1)
  })
  it('explainPlan falls back to a deterministic summary on failure', async () => {
    const r = await explainPlan('Today: 4h lab + gym', caller('not json'))
    expect(r.summary).toContain('lab')
  })
  it('parseReplan returns unknown intent on failure', async () => {
    const r = await parseReplan('do something', caller('nope'))
    expect(r.intent).toBe('unknown')
  })
})
