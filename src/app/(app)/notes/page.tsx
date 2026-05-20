'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PadGrid } from '@/components/notes/PadGrid'
import { UniversalInput } from '@/components/input/UniversalInput'
import type { Notepad, Note } from '@/types'

export default function NotesPage() {
  const supabase = createClient()
  const [pads, setPads] = useState<Notepad[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('notepads').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order'),
      supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    ]).then(([{ data: padData }, { data: noteData }]) => {
      if (padData) setPads(padData)
      if (noteData) setNotes(noteData)
    })
  }, [userId])

  const handleInput = useCallback(async (input: string) => {
    if (!userId) return
    await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        context: { user_name: 'Athreya', notepads: pads.map((p) => ({ name: p.name })) },
      }),
    })
  }, [userId, pads])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>Notes</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        <PadGrid pads={pads} notes={notes} />
      </div>

      <div style={{ padding: '8px 16px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <UniversalInput
          placeholder="Add to a pad or ask about your notes…"
          onSubmit={handleInput}
        />
      </div>
    </div>
  )
}
