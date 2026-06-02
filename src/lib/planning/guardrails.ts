import type { Guardrail } from '@/types'
import type { SkeletonItem } from './engine-types'

function atTime(windowStart: string, hhmm: string): string {
  const date = windowStart.slice(0, 10) // YYYY-MM-DD (UTC)
  const [h, m] = hhmm.split(':')
  return `${date}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00.000Z`
}

function clampRange(start: string, end: string, ws: string, we: string): [string, string] | null {
  const s = Math.max(Date.parse(start), Date.parse(ws))
  const e = Math.min(Date.parse(end), Date.parse(we))
  if (e <= s) return null
  return [new Date(s).toISOString(), new Date(e).toISOString()]
}

export function guardrailsToSkeleton(
  guardrails: Guardrail[], windowStart: string, windowEnd: string,
): SkeletonItem[] {
  const planDate = windowStart.slice(0, 10)
  const out: SkeletonItem[] = []
  for (const gr of guardrails) {
    if (!gr.is_active) continue
    const p = gr.payload as Record<string, string>
    let range: [string, string] | null = null
    let label = ''
    switch (gr.kind) {
      case 'no_work_before':
        range = clampRange(windowStart, atTime(windowStart, p.time), windowStart, windowEnd)
        label = `No work before ${p.time}`
        break
      case 'no_work_after':
        range = clampRange(atTime(windowStart, p.time), windowEnd, windowStart, windowEnd)
        label = `No work after ${p.time}`
        break
      case 'protected_window':
        range = clampRange(atTime(windowStart, p.start), atTime(windowStart, p.end), windowStart, windowEnd)
        label = `Protected ${p.start}\u2013${p.end}`
        break
      case 'break_day':
        if (p.date === planDate) { range = [windowStart, windowEnd]; label = 'Break day' }
        break
    }
    if (range) out.push({ id: gr.id, start: range[0], end: range[1], state: 'rest_lockout', label })
  }
  return out
}
