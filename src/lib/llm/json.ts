import type { z } from 'zod'

/**
 * Pull the first balanced JSON object/array out of arbitrary model text,
 * tolerating code fences and surrounding prose.
 */
export function extractJson(text: string): unknown {
  const start = firstJsonStart(text)
  if (start === -1) throw new Error('no JSON found in model output')

  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        const slice = text.slice(start, i + 1)
        return JSON.parse(slice)
      }
    }
  }
  throw new Error('no balanced JSON found in model output')
}

function firstJsonStart(text: string): number {
  const obj = text.indexOf('{')
  const arr = text.indexOf('[')
  if (obj === -1) return arr
  if (arr === -1) return obj
  return Math.min(obj, arr)
}

export function parseWith<T>(schema: z.ZodType<T>, text: string): T {
  const raw = extractJson(text)
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error(`model output failed schema validation: ${result.error.message}`)
  }
  return result.data
}
