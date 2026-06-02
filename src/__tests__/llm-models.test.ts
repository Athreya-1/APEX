import { routeModel, MODELS } from '@/lib/llm/models'

describe('routeModel', () => {
  it('routes cheap parse/classify jobs to Haiku', () => {
    expect(routeModel('parse_quick_add')).toBe(MODELS.HAIKU)
    expect(routeModel('parse_replan')).toBe(MODELS.HAIKU)
    expect(routeModel('classify')).toBe(MODELS.HAIKU)
  })
  it('routes nuanced jobs to Sonnet', () => {
    expect(routeModel('decompose_goal')).toBe(MODELS.SONNET)
    expect(routeModel('explain_plan')).toBe(MODELS.SONNET)
  })
})
