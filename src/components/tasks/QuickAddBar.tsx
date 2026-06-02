'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { parseQuickAddLocal } from '@/lib/llm/quickAddLocal'
import type { QuickAddResult } from '@/lib/llm/schemas'
import { QuickAddPreview } from './QuickAddPreview'
import { ClarifyOverlay, type ClarifyMessage } from './ClarifyOverlay'
import { EstimateModal } from './EstimateModal'
import type { Task } from '@/types'

interface QuickAddBarProps {
  knownCourses: string[]
  onTaskCreated: (task: Task) => void
}

interface PendingEstimate {
  text: string
  clarify?: Record<string, string>
  title: string
  suggestedHours: number
}

export function QuickAddBar({ knownCourses, onTaskCreated }: QuickAddBarProps) {
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState<QuickAddResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [clarifyActive, setClarifyActive] = useState(false)
  const [messages, setMessages] = useState<ClarifyMessage[]>([])
  const [clarifyPartial, setClarifyPartial] = useState<Record<string, string>>({})
  const [pendingText, setPendingText] = useState('')
  const [pendingEst, setPendingEst] = useState<PendingEstimate | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runLocalPreview = useCallback((text: string) => {
    if (!text.trim()) { setPreview(null); return }
    const now = new Date().toISOString()
    setPreview(parseQuickAddLocal(text, { now, knownCourses }))
  }, [knownCourses])

  useEffect(() => {
    if (clarifyActive) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runLocalPreview(value), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value, clarifyActive, runLocalPreview])

  async function submitToApi(text: string, extra?: { estimate_hours?: number; clarify?: Record<string, string> }) {
    const res = await fetch('/api/tasks/quick-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...extra }),
    })
    return res.json()
  }

  async function finishAdd(text: string, extra?: { estimate_hours?: number; clarify?: Record<string, string> }) {
    setLoading(true)
    try {
      const data = await submitToApi(text, extra)
      if (data.kind === 'clarify') {
        setPendingText(text)
        setClarifyActive(true)
        setMessages([{ role: 'system', text: data.question }])
        return
      }
      if (data.kind === 'needs_estimate') {
        setPendingEst({
          text,
          clarify: extra?.clarify,
          title: data.parsed?.title ?? text,
          suggestedHours: data.suggested_hours,
        })
        return
      }
      if (data.kind === 'task' && data.task) {
        onTaskCreated(data.task as Task)
        setValue('')
        setPreview(null)
        setClarifyActive(false)
        setMessages([])
        setClarifyPartial({})
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || loading) return
    if (clarifyActive) {
      setMessages((m) => [...m, { role: 'user', text: trimmed }])
      const next = { ...clarifyPartial, courseCode: trimmed }
      setClarifyPartial(next)
      setValue('')
      setClarifyActive(false)
      await finishAdd(pendingText || trimmed, { clarify: next })
      return
    }
    await finishAdd(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape' && clarifyActive) {
      setClarifyActive(false)
      setMessages([])
    }
  }

  const courseChips = knownCourses.slice(0, 6)

  return (
    <div style={{ position: 'relative' }}>
      <ClarifyOverlay
        active={clarifyActive}
        messages={messages}
        chips={clarifyActive ? courseChips : undefined}
        onChip={(c) => { setValue(c); handleSend() }}
      />
      <QuickAddPreview result={clarifyActive ? null : preview} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 22, padding: '7px 7px 7px 16px',
      }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={clarifyActive ? 'Reply…' : 'Add a task — e.g. 15-213 lab 3 /213 4h due thursday'}
          disabled={loading}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)', minWidth: 0,
          }}
        />
        <button
          type="button"
          aria-label="Send"
          onClick={handleSend}
          disabled={loading || !value.trim()}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--amber)', border: 'none',
            opacity: loading || !value.trim() ? 0.5 : 1,
            cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
      <EstimateModal
        open={pendingEst != null}
        taskTitle={pendingEst?.title ?? ''}
        suggestedHours={pendingEst?.suggestedHours}
        onCancel={() => setPendingEst(null)}
        onConfirm={(hours) => {
          const p = pendingEst
          setPendingEst(null)
          if (p) finishAdd(p.text, { estimate_hours: hours, clarify: p.clarify })
        }}
      />
    </div>
  )
}
