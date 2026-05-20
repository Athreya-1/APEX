'use client'
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { UniversalInput } from '@/components/input/UniversalInput'
import type { KnowledgeBankEntry } from '@/types'

const SOURCE_LABELS: Record<string, string> = {
  task: 'Task',
  note: 'Note',
  plan: 'Plan',
  habit: 'Habit',
  manual_drop: 'Drop',
  canvas: 'Canvas',
  exam: 'Exam',
}

const SOURCE_COLORS: Record<string, string> = {
  task: 'var(--amber)',
  note: 'var(--blue)',
  plan: 'var(--green)',
  habit: 'var(--pink)',
  manual_drop: 'var(--text3)',
  canvas: 'var(--purple)',
  exam: 'var(--red)',
}

export default function KnowledgePage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [entries, setEntries] = useState<KnowledgeBankEntry[]>([])
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [isQuerying, setIsQuerying] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return
    let q = supabase
      .from('knowledge_bank')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (filterType !== 'all') q = q.eq('source_type', filterType)
    q.then(({ data }) => {
      if (data) setEntries(data)
    })
  }, [userId, filterType]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuery = async (input: string): Promise<void> => {
    setQuery(input)
    setIsQuerying(true)
    setAnswer(null)
    try {
      const res = await fetch('/api/knowledge/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      })
      const { answer: a } = await res.json()
      setAnswer(a)
    } catch {
      setAnswer('Failed to query knowledge bank.')
    } finally {
      setIsQuerying(false)
    }
  }

  const filterTypes = ['all', 'task', 'note', 'plan', 'habit', 'canvas', 'exam']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>
          Knowledge Bank
        </span>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text3)',
            fontFamily: 'var(--font-mono)',
            marginTop: 2,
          }}
        >
          {entries.length} entries indexed
        </div>
      </div>

      {/* Filter pills */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}
      >
        {filterTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              border: `1px solid ${filterType === t ? 'var(--amber-dim)' : 'var(--border2)'}`,
              background: filterType === t ? 'var(--amber-bg)' : 'var(--bg3)',
              color: filterType === t ? 'var(--amber)' : 'var(--text3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {t === 'all' ? 'All' : (SOURCE_LABELS[t] ?? t)}
          </button>
        ))}
      </div>

      {/* Answer card */}
      {(isQuerying || answer) && (
        <div
          style={{
            margin: '0 16px 10px',
            background: 'var(--amber-bg)',
            border: '1px solid var(--amber-dim)',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--amber)',
              fontFamily: 'var(--font-mono)',
              marginBottom: 6,
            }}
          >
            {isQuerying ? 'Searching…' : `Answer for: "${query}"`}
          </div>
          {answer && (
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
              {answer}
            </p>
          )}
        </div>
      )}

      {/* Entries list */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px', scrollbarWidth: 'none' }}
      >
        {entries.map((e) => (
          <div
            key={e.id}
            style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 6,
                borderRadius: 3,
                flexShrink: 0,
                alignSelf: 'stretch',
                background: SOURCE_COLORS[e.source_type] ?? 'var(--text3)',
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text)',
                  lineHeight: 1.5,
                  marginBottom: 4,
                }}
              >
                {e.content.length > 120 ? e.content.slice(0, 120) + '…' : e.content}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 10,
                    background: `${SOURCE_COLORS[e.source_type] ?? 'var(--text3)'}22`,
                    color: SOURCE_COLORS[e.source_type] ?? 'var(--text3)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {SOURCE_LABELS[e.source_type] ?? e.source_type}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text3)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              paddingTop: 40,
              color: 'var(--text3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            Nothing indexed yet.
            <br />
            Add tasks and notes to populate your knowledge bank.
          </div>
        )}
      </div>

      <div
        style={{
          padding: '8px 16px 14px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <UniversalInput
          placeholder="Ask anything — search your tasks, notes, and plans…"
          onSubmit={handleQuery}
          loading={isQuerying}
        />
      </div>
    </div>
  )
}
