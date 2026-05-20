'use client'
import { formatDistanceToNow } from 'date-fns'
import type { Note } from '@/types'

interface NoteEntryProps {
  note: Note
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  typed:       { label: 'Typed', color: 'var(--text3)' },
  voice:       { label: 'Voice', color: 'var(--blue)' },
  ai_appended: { label: 'APEX', color: 'var(--amber)' },
  apex:        { label: 'APEX', color: 'var(--amber)' },
}

export function NoteEntry({ note }: NoteEntryProps) {
  const source = SOURCE_LABELS[note.source] ?? SOURCE_LABELS.typed

  return (
    <div style={{
      padding: '11px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
        </span>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 6px',
          borderRadius: 3, background: 'var(--bg3)', color: source.color,
          textTransform: 'uppercase', letterSpacing: '.05em',
        }}>
          {source.label}
        </span>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
        {note.content}
      </div>
    </div>
  )
}
