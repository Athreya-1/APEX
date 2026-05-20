'use client'
import { format, differenceInMinutes } from 'date-fns'
import type { PlanBlock, BlockType } from '@/types'

interface PlanBlockProps {
  block: PlanBlock
  isCurrent: boolean
  onCheckin?: (blockId: string) => void
}

function getBlockStyle(type: BlockType): { bg: string; border: string; stripe: string } {
  switch (type) {
    case 'deep_work':
    case 'entrepreneur':
      return { bg: '#1e1a12', border: '#2e260f', stripe: 'var(--amber)' }
    case 'class':
      return { bg: '#121a20', border: '#1a2e3a', stripe: 'var(--blue)' }
    case 'meal':
      return { bg: '#131a12', border: '#1e2e1a', stripe: 'var(--green)' }
    case 'cmr':
      return { bg: '#1a1220', border: '#2a1a30', stripe: 'var(--pink)' }
    case 'break':
      return { bg: 'var(--bg2)', border: 'var(--border)', stripe: 'var(--bg4)' }
    default:
      return { bg: 'var(--bg2)', border: 'var(--border)', stripe: 'var(--border2)' }
  }
}

function getBadge(block: PlanBlock, isCurrent: boolean): { label: string; bg: string; color: string } | null {
  if (block.status === 'done') return { label: 'DONE', bg: 'var(--bg4)', color: 'var(--text3)' }
  if (isCurrent) return { label: 'NOW', bg: 'var(--amber)', color: '#000' }
  if (block.block_type === 'deep_work' || block.block_type === 'entrepreneur') {
    return { label: 'DEEP', bg: 'var(--amber-dim)', color: 'var(--amber)' }
  }
  if (block.block_type === 'class') return { label: 'CLASS', bg: '#0d1e2e', color: 'var(--blue)' }
  return null
}

export function PlanBlock({ block, isCurrent, onCheckin }: PlanBlockProps) {
  const styles = getBlockStyle(block.block_type)
  const badge = getBadge(block, isCurrent)
  const isDone = block.status === 'done'
  const durationMins = differenceInMinutes(new Date(block.end_time), new Date(block.start_time))

  return (
    <div
      role="article"
      onClick={() => onCheckin?.(block.id)}
      style={{
        flex: 1,
        borderRadius: 10,
        padding: '9px 11px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'opacity .15s',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        opacity: isDone ? 0.4 : 1,
        boxShadow: isCurrent ? '0 0 0 1px var(--amber)' : 'none',
      }}
    >
      {/* Left stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        borderRadius: '2px 0 0 2px', background: styles.stripe,
      }} />

      <div style={{ marginLeft: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.01em' }}>
          {block.label ?? block.block_type}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {format(new Date(block.start_time), 'h:mm')}–{format(new Date(block.end_time), 'h:mma')} · {durationMins}m
        </div>
      </div>

      {badge && (
        <div style={{
          position: 'absolute', right: 8, top: 8,
          fontSize: 9, fontFamily: 'var(--font-mono)',
          padding: '2px 6px', borderRadius: 3,
          textTransform: 'uppercase', letterSpacing: '.06em',
          background: badge.bg, color: badge.color,
          fontWeight: badge.label === 'NOW' ? 500 : 400,
        }}>
          {badge.label}
        </div>
      )}
    </div>
  )
}
