'use client'

import { useState, useCallback } from 'react'

interface HabitsInputBarProps {
  placeholder?: string
  onSubmit: (input: string) => Promise<void>
  loading?: boolean
}

export function HabitsInputBar({
  placeholder = 'Log a habit, add a goal, or ask about your streaks…',
  onSubmit,
  loading = false,
}: HabitsInputBarProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed || submitting || loading) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }, [value, submitting, loading, onSubmit])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="todo-inputbar">
      <div className="todo-pill">
        <svg className="ic" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 21s-7-4.35-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.65-9 9-9 9z" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={submitting || loading}
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
          onClick={() => { void handleSubmit() }}
          disabled={submitting || loading || !value.trim()}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
