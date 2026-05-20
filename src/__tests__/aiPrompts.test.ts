import { INTENT_CLASSIFICATION_PROMPT } from '@/lib/ai/prompts'

describe('AI Prompts', () => {
  it('exports INTENT_CLASSIFICATION_PROMPT', () => {
    expect(typeof INTENT_CLASSIFICATION_PROMPT).toBe('string')
    expect(INTENT_CLASSIFICATION_PROMPT.length).toBeGreaterThan(100)
  })

  it('INTENT_CLASSIFICATION_PROMPT contains expected keys', () => {
    expect(INTENT_CLASSIFICATION_PROMPT).toContain('add_task')
    expect(INTENT_CLASSIFICATION_PROMPT).toContain('intent')
  })
})
