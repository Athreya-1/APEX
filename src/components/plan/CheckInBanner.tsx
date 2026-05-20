'use client'
import { useState } from 'react'
import type { PlanBlock } from '@/types'

interface CheckInBannerProps {
  block: PlanBlock
  onResponse: (blockId: string, choice: 'done' | '+15' | '+30' | '+45' | '+60' | 'custom', extraMins?: number) => Promise<void>
}

export function CheckInBanner({ block, onResponse }: CheckInBannerProps) {
  const [loading, setLoading] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customMins, setCustomMins] = useState('')

  async function handle(choice: 'done' | '+15' | '+30' | '+45' | '+60' | 'custom', extraMins?: number) {
    setLoading(true)
    try {
      await onResponse(block.id, choice, extraMins)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      margin: '0 20px 12px',
      background: '#1a1600',
      border: '1px solid var(--amber-dim)',
      borderRadius: 10,
      padding: '11px 14px',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>
        <strong style={{ color: 'var(--amber)' }}>{block.label ?? block.block_type}</strong> block ended — how&apos;s it going?
      </div>

      {showCustom ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number"
            value={customMins}
            onChange={(e) => setCustomMins(e.target.value)}
            placeholder="mins"
            style={{
              width: 70, padding: '5px 8px', background: 'var(--bg3)',
              border: '1px solid var(--border2)', borderRadius: 6,
              color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none',
            }}
            aria-label="Custom minutes"
          />
          <button
            onClick={() => handle('custom', parseInt(customMins) || 30)}
            disabled={loading}
            style={{
              flex: 1, padding: '6px', borderRadius: 6,
              background: 'var(--amber)', border: 'none',
              color: '#000', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            Add
          </button>
          <button
            onClick={() => setShowCustom(false)}
            style={{
              padding: '6px 10px', borderRadius: 6, background: 'var(--bg3)',
              border: '1px solid var(--border2)', color: 'var(--text2)',
              fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          {(['done', '+15', '+30', '+45', '+60'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => opt === 'done'
                ? handle('done')
                : handle(opt as '+15' | '+30' | '+45' | '+60', parseInt(opt.slice(1)))}
              disabled={loading}
              style={{
                flex: 1, padding: 6, borderRadius: 6,
                background: opt === 'done' ? 'var(--amber)' : 'var(--bg3)',
                border: opt === 'done' ? 'none' : '1px solid var(--border2)',
                color: opt === 'done' ? '#000' : 'var(--text2)',
                fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                fontWeight: opt === 'done' ? 500 : 400,
              }}
            >
              {opt}
            </button>
          ))}
          <button
            onClick={() => setShowCustom(true)}
            style={{
              flex: 1, padding: 6, borderRadius: 6,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              color: 'var(--text2)', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            custom
          </button>
        </div>
      )}
    </div>
  )
}
