'use client'
import { useMemo } from 'react'
import { format, isWithinInterval } from 'date-fns'
import { PlanBlock } from './PlanBlock'
import type { PlanBlock as PlanBlockType } from '@/types'

interface DayTimelineProps {
  blocks: PlanBlockType[]
  onCheckin?: (blockId: string) => void
}

export function DayTimeline({ blocks, onCheckin }: DayTimelineProps) {
  const now = new Date()

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [blocks],
  )

  const currentBlockId = useMemo(() => {
    const current = sortedBlocks.find((b) =>
      isWithinInterval(now, { start: new Date(b.start_time), end: new Date(b.end_time) }),
    )
    return current?.id ?? null
  }, [sortedBlocks])

  if (!sortedBlocks.length) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        No plan yet — generate one below
      </div>
    )
  }

  return (
    <div
      data-testid="day-timeline"
      style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 2, scrollbarWidth: 'none' }}
    >
      {sortedBlocks.map((block) => (
        <div key={block.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 36 }}>
          {/* Time label */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)',
            width: 36, flexShrink: 0, paddingTop: 10, textAlign: 'right',
          }}>
            {format(new Date(block.start_time), 'h:mm')}
          </div>

          {/* Gutter line */}
          <div style={{
            width: 1,
            background: currentBlockId === block.id ? 'var(--amber)' : 'var(--border)',
            flexShrink: 0, marginTop: 10,
          }} />

          {/* Block card */}
          <PlanBlock
            block={block}
            isCurrent={currentBlockId === block.id}
            onCheckin={onCheckin}
          />
        </div>
      ))}
    </div>
  )
}
