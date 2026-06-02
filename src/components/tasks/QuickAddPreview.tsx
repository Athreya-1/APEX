'use client'
import type { QuickAddResult } from '@/lib/llm/schemas'
import { formatEstimateHours } from '@/lib/tasks/estimate-stops'

interface QuickAddPreviewProps {
  result: QuickAddResult | null
}

export function QuickAddPreview({ result }: QuickAddPreviewProps) {
  if (!result) return null

  if (result.kind === 'clarify') {
    return (
      <div style={{
        padding: '6px 12px', marginBottom: 6,
        fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)',
      }}>
        Needs: {result.missingFields.join(', ')}
      </div>
    )
  }

  const chips: string[] = []
  if (result.courseCode) chips.push(result.courseCode)
  if (result.taskType && result.taskType !== 'other') chips.push(result.taskType)
  if (result.estimateHours) chips.push(formatEstimateHours(result.estimateHours))
  if (result.dueDate) chips.push(`due ${result.dueDate.slice(0, 10)}`)

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 12px 8px',
      animation: 'fadeIn .2s ease',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text2)', flex: '1 1 100%' }}>
        {result.title}
      </span>
      {chips.map((c) => (
        <span key={c} style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 8px',
          borderRadius: 4, background: 'var(--bg4)', color: 'var(--amber)',
          textTransform: 'uppercase', letterSpacing: '.04em',
        }}>
          {c}
        </span>
      ))}
    </div>
  )
}
