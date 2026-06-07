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

  const runLocalPreview = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setPreview(null)
        return
      }
      const now = new Date().toISOString()
      setPreview(parseQuickAddLocal(text, { now, knownCourses }))
    },
    [knownCourses],
  )

  useEffect(() => {
    if (clarifyActive) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runLocalPreview(value), 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && clarifyActive) {
      setClarifyActive(false)
      setMessages([])
    }
  }

  function cancelClarify() {
    setClarifyActive(false)
    setMessages([])
  }

  const courseChips = knownCourses.slice(0, 6)

  return (
    <>
      <ClarifyOverlay
        active={clarifyActive}
        messages={messages}
        chips={clarifyActive ? courseChips : undefined}
        onChip={(c) => {
          setValue(c)
          handleSend()
        }}
        onCancel={cancelClarify}
      />

      <div className="todo-inputbar">
        <QuickAddPreview result={clarifyActive ? null : preview} />
        <div className="todo-pill">
          <svg className="ic" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3" />
          </svg>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={clarifyActive ? 'Reply…' : 'Add a task…  try:  213 lab 5 due thu'}
            disabled={loading}
            autoComplete="off"
          />
          <svg className="ic" viewBox="0 0 24 24" aria-hidden>
            <path d="M21 15l-5-5L5 21M14 4l6 6" />
            <rect x="3" y="3" width="18" height="18" rx="3" />
          </svg>
          <button
            type="button"
            className="send"
            aria-label="Send"
            onClick={handleSend}
            disabled={loading || !value.trim()}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
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
    </>
  )
}
