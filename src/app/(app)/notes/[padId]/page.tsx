'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { isToday, isThisWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { NoteEntry } from '@/components/notes/NoteEntry'
import { UniversalInput } from '@/components/input/UniversalInput'
import type { Notepad, Note } from '@/types'

type NoteFilter = 'All' | 'Today' | 'This week'

export default function PadPage() {
  const { padId } = useParams<{ padId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [pad, setPad] = useState<Notepad | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [filter, setFilter] = useState<NoteFilter>('All')
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    if (!userId || !padId) return
    Promise.all([
      supabase.from('notepads').select('*').eq('id', padId).single(),
      supabase.from('notes').select('*').eq('notepad_id', padId).order('created_at', { ascending: false }),
    ]).then(([{ data: padData }, { data: noteData }]) => {
      if (padData) setPad(padData)
      if (noteData) setNotes(noteData)
    })
  }, [userId, padId])

  const filteredNotes = notes.filter((note) => {
    if (filter === 'Today') return isToday(new Date(note.created_at))
    if (filter === 'This week') return isThisWeek(new Date(note.created_at), { weekStartsOn: 1 })
    return true
  })

  const handleInput = useCallback(async (input: string) => {
    if (!userId || !pad) return
    const { data } = await supabase.from('notes').insert({
      notepad_id: padId,
      user_id: userId,
      content: input,
      source: 'typed',
    }).select().single()
    if (data) setNotes((prev) => [data as Note, ...prev])
  }, [userId, pad, padId])

  if (!pad) return <div style={{ padding: 20, color: 'var(--text3)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', color: 'var(--text3)',
            fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            marginBottom: 8, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{pad.icon}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: pad.color }}>{pad.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
              {notes.length} entries
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {(['All', 'Today', 'This week'] as NoteFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                padding: '3px 10px', borderRadius: 20,
                border: `1px solid ${filter === f ? 'var(--amber-dim)' : 'var(--border2)'}`,
                background: filter === f ? 'var(--amber-bg)' : 'transparent',
                color: filter === f ? 'var(--amber)' : 'var(--text2)',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
        {filteredNotes.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            No entries yet — add one below
          </div>
        ) : (
          filteredNotes.map((note) => <NoteEntry key={note.id} note={note} />)
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '8px 16px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <UniversalInput
          placeholder={`Add to ${pad.name}…`}
          onSubmit={handleInput}
        />
      </div>
    </div>
  )
}
