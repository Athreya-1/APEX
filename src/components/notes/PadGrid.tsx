'use client'
import { PadCard } from './PadCard'
import type { Notepad, Note } from '@/types'

interface PadGridProps {
  pads: Notepad[]
  notes: Note[]
  onCreatePad?: () => void
}

export function PadGrid({ pads, notes, onCreatePad }: PadGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 10,
      padding: '12px 16px',
    }}>
      {pads.map((pad) => {
        const padNotes = notes.filter((n) => n.notepad_id === pad.id)
        return (
          <PadCard
            key={pad.id}
            pad={pad}
            entryCount={padNotes.length}
            preview={padNotes[0]?.content.slice(0, 60)}
          />
        )
      })}
      <div
        onClick={onCreatePad}
        style={{
          border: '1px dashed var(--border2)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text3)',
          fontSize: 24,
          minHeight: 100,
        }}
      >
        +
      </div>
    </div>
  )
}
