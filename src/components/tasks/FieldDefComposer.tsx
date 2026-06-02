'use client'
import { useState } from 'react'
import type { FieldKind } from '@/types'

interface FieldDefComposerProps {
  onAdd: (name: string, kind: FieldKind, options?: string[]) => Promise<void>
  onClose: () => void
}

export function FieldDefComposer({ onAdd, onClose }: FieldDefComposerProps) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<FieldKind>('text')
  const [options, setOptions] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const opts = kind === 'single_select'
        ? options.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined
      await onAdd(name.trim(), kind, opts?.length ? opts : ['Option 1', 'Option 2'])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      gridColumn: '1 / -1',
      padding: 14,
      borderRadius: 13,
      background: 'var(--bg3)',
      border: '1px solid var(--border2)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <input
        type="text"
        placeholder="Field name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          fontSize: 12, padding: '8px 10px', borderRadius: 8,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          color: 'var(--text)', outline: 'none', width: '100%',
        }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        {(['text', 'single_select', 'checkbox'] as FieldKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            style={{
              flex: 1, fontSize: 10, padding: '6px 0', borderRadius: 8, cursor: 'pointer',
              background: kind === k ? 'rgba(245,166,35,.15)' : 'var(--bg2)',
              border: `1px solid ${kind === k ? 'rgba(245,166,35,.4)' : 'var(--border2)'}`,
              color: kind === k ? 'var(--amber)' : 'var(--text2)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {k === 'single_select' ? 'Dropdown' : k === 'checkbox' ? 'On-off' : 'Text'}
          </button>
        ))}
      </div>
      {kind === 'single_select' && (
        <input
          type="text"
          placeholder="Options, comma-separated"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          style={{
            fontSize: 11, padding: '8px 10px', borderRadius: 8,
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            color: 'var(--text2)', outline: 'none', width: '100%',
            fontFamily: 'var(--font-mono)',
          }}
        />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
        <button type="button" onClick={handleAdd} disabled={saving || !name.trim()} style={primaryBtn}>
          Add field
        </button>
      </div>
    </div>
  )
}

const secondaryBtn: React.CSSProperties = {
  flex: 1, fontSize: 11, padding: '8px 0', borderRadius: 8,
  background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  flex: 1, fontSize: 11, padding: '8px 0', borderRadius: 8,
  background: 'var(--amber)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer',
}
