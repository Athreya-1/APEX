'use client'
import { useState, useRef, useCallback } from 'react'
import { VoiceOrb } from '@/components/input/VoiceOrb'

interface UniversalInputProps {
  placeholder?: string
  onSubmit: (input: string, image?: File) => Promise<void>
  className?: string
  loading?: boolean
}

export function UniversalInput({
  placeholder = 'Ask APEX anything…',
  onSubmit,
  className = '',
  loading = false,
}: UniversalInputProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed, undefined)
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }, [value, submitting, onSubmit])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={`relative ${className}`}>
      {showVoice && (
        <VoiceOrb
          mode="mini"
          onSubmit={(text) => {
            setShowVoice(false)
            setValue(text)
            onSubmit(text, undefined)
          }}
          onClose={() => setShowVoice(false)}
        />
      )}
      {/* gradient fade zone */}
      <div
        className="pointer-events-none absolute -top-8 left-0 right-0 h-8"
        aria-hidden="true"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--bg))' }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--bg3)',
          border: '1px solid var(--border2)',
          borderRadius: '22px',
          padding: '7px 7px 7px 16px',
          transition: 'border-color .2s, box-shadow .2s',
        }}
        onFocusCapture={(e) => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = 'rgba(245,166,35,0.35)'
          el.style.boxShadow = '0 0 0 3px rgba(245,166,35,0.06)'
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--border2)'
            el.style.boxShadow = 'none'
          }
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={submitting || loading}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text)',
            minWidth: 0,
          }}
        />

        {/* Mic icon */}
        <button
          type="button"
          aria-label="Voice input"
          onClick={() => setShowVoice(true)}
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'none', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--text3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </button>

        {/* Paperclip / attach icon */}
        <button
          type="button"
          aria-label="Attach file"
          onClick={() => fileRef.current?.click()}
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'none', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--text3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} aria-hidden="true" />

        {/* Send button */}
        <button
          type="button"
          aria-label="Send"
          onClick={handleSubmit}
          disabled={submitting || loading || !value.trim()}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--amber)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: submitting || !value.trim() ? 'not-allowed' : 'pointer',
            opacity: submitting || !value.trim() ? 0.5 : 1,
            flexShrink: 0,
            transition: 'opacity .15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
