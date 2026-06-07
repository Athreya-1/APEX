'use client'

import type { QuickAddResult } from '@/lib/llm/schemas'
import { formatEstimateHours } from '@/lib/tasks/estimate-stops'
import { SparkIcon } from '@/components/ui/SparkIcon'

interface QuickAddPreviewProps {
  result: QuickAddResult | null
}

export function QuickAddPreview({ result }: QuickAddPreviewProps) {
  if (!result || result.kind === 'clarify') {
    return <div className={`todo-parsepreview${result?.kind === 'clarify' ? ' show' : ''}`} />
  }

  const chips: { key: string; label: string; className?: string }[] = []
  if (result.courseCode) chips.push({ key: 'course', label: result.courseCode, className: 'course' })
  if (result.taskType && result.taskType !== 'other') {
    chips.push({ key: 'type', label: result.taskType })
  }
  if (result.estimateHours) {
    chips.push({ key: 'est', label: formatEstimateHours(result.estimateHours) })
  }
  if (result.dueDate) chips.push({ key: 'due', label: `due ${result.dueDate.slice(0, 10)}` })

  return (
    <div className="todo-parsepreview show">
      <span className="todo-pp-lbl">Parsed</span>
      <span className="todo-pp-chip">
        <span className="k">title</span> {result.title}
      </span>
      {chips.map((c) => (
        <span key={c.key} className={`todo-pp-chip${c.className ? ` ${c.className}` : ''}`}>
          {c.key === 'est' && <SparkIcon className="todo-autoic" />}
          {c.label}
        </span>
      ))}
    </div>
  )
}
