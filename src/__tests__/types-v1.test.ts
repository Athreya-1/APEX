import type {
  CognitiveClass, SlotState, PaddedEffort, UrgencyResult,
  Goal, TaskFieldDef, Guardrail, FocusSession,
} from '@/types'

describe('V1 type contracts', () => {
  it('CognitiveClass values are usable', () => {
    const c: CognitiveClass = 'heavy_focus'
    expect(c).toBe('heavy_focus')
  })
  it('SlotState values are usable', () => {
    const s: SlotState = 'available'
    expect(s).toBe('available')
  })
  it('PaddedEffort shape holds', () => {
    const e: PaddedEffort = {
      estimateHours: 4, paddedHours: 5.2, stdevHours: 0.8,
      sampleSize: 3, source: 'bucket_history', confidence: 'warm',
    }
    expect(e.paddedHours).toBeGreaterThan(e.estimateHours)
  })
  it('UrgencyResult + Goal + TaskFieldDef + Guardrail + FocusSession compile', () => {
    const u: UrgencyResult = { taskId: 't', score: 1.2, isAtRisk: false, slackHours: 3, paddedHours: 5 }
    const g: Goal = { id: 'g', user_id: 'u', name: 'Launch', description: null, target_metric: null, deadline: null, color: 'x', status: 'active', sort_order: 0, created_at: '', updated_at: '' }
    const f: TaskFieldDef = { id: 'f', user_id: 'u', name: 'Energy', kind: 'single_select', options: ['low', 'high'], sort_order: 0, created_at: '' }
    const r: Guardrail = { id: 'r', user_id: 'u', kind: 'no_work_after', payload: { time: '20:00' }, hard: true, is_active: true, created_at: '' }
    const s: FocusSession = { id: 's', user_id: 'u', task_id: 't', plan_block_id: null, started_at: '', ended_at: '', interrupted: false, user_reported_efficiency: 4, cognitive_class: 'heavy_focus', created_at: '' }
    expect([u.score, g.status, f.kind, r.hard, s.interrupted]).toBeTruthy()
  })
})
