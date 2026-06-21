import { noWorkTimesFromGuardrails } from '@/lib/guardrails/sync'
import type { Guardrail } from '@/types'

function gr(kind: Guardrail['kind'], time: string, is_active = true): Guardrail {
  return {
    id: `gr-${kind}`,
    user_id: 'u1',
    kind,
    payload: { time },
    hard: true,
    is_active,
    created_at: new Date().toISOString(),
  }
}

describe('noWorkTimesFromGuardrails', () => {
  it('extracts no_work_before and no_work_after times', () => {
    const result = noWorkTimesFromGuardrails([
      gr('no_work_before', '08:00'),
      gr('no_work_after', '22:00'),
    ])
    expect(result).toEqual({ no_work_before: '08:00', no_work_after: '22:00' })
  })

  it('skips inactive guardrails', () => {
    const result = noWorkTimesFromGuardrails([
      gr('no_work_before', '08:00', false),
      gr('no_work_after', '22:00'),
    ])
    expect(result).toEqual({ no_work_before: null, no_work_after: '22:00' })
  })
})
