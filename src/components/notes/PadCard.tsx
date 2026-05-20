'use client'
import Link from 'next/link'
import type { Notepad } from '@/types'

interface PadCardProps {
  pad: Notepad
  entryCount: number
  preview?: string
}

export function PadCard({ pad, entryCount, preview }: PadCardProps) {
  return (
    <Link
      href={`/notes/${pad.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color .15s',
        minHeight: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 22 }}>{pad.icon}</span>
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text3)',
            background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4,
          }}>
            {entryCount}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: pad.color, letterSpacing: '-.01em' }}>
          {pad.name}
        </div>
        {preview && (
          <div style={{
            fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {preview}
          </div>
        )}
      </div>
    </Link>
  )
}
