import { extractJson } from '@/lib/llm/json'

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })
  it('strips code fences and surrounding prose', () => {
    expect(extractJson('Sure!\n```json\n{"a":2}\n```\nDone')).toEqual({ a: 2 })
  })
  it('finds the first object inside mixed text', () => {
    expect(extractJson('prefix {"x":true} suffix')).toEqual({ x: true })
  })
  it('handles braces inside strings', () => {
    expect(extractJson('{"note":"a } b"}')).toEqual({ note: 'a } b' })
  })
  it('throws when there is no JSON', () => {
    expect(() => extractJson('nothing here')).toThrow()
  })
})
