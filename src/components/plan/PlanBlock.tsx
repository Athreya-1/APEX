'use client'
import { format, differenceInMinutes } from 'date-fns'
import type { PlanBlock, BlockType } from '@/types'

interface PlanBlockProps {
  block: PlanBlock
  isCurrent: boolean
}

const ACCENT: Record<BlockType | string, string> = {
  deep_work: 'var(--amber)',
  entrepreneur: 'var(--amber-soft)',
  class: 'var(--blue)',
  meal: 'var(--green)',
  gym: 'var(--violet)',
  cmr: 'var(--pink)',
  creative: 'var(--amber-soft)',
  break: 'var(--neutral, #6f6d65)',
  routine: 'var(--neutral, #6f6d65)',
  sleep: 'var(--neutral, #6f6d65)',
  admin: 'var(--blue)',
  custom: 'var(--neutral, #6f6d65)',
}

const HABIT_REPEAT_ICON = (
  <svg className="rep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
    <path d="M17 2l4 4-4 4M21 6H7a4 4 0 00-4 4v1M7 22l-4-4 4-4M3 18h14a4 4 0 004-4v-1" />
  </svg>
)

export function PlanBlock({ block, isCurrent }: PlanBlockProps) {
  const accent = ACCENT[block.block_type] ?? 'var(--neutral, #6f6d65)'
  const isDone = block.status === 'done'
  const durationMins = differenceInMinutes(new Date(block.end_time), new Date(block.start_time))
  const isCompact = durationMins <= 25
  const isHabit = !block.task_id && (block.block_type === 'gym' || block.block_type === 'routine')

  const isMuted = block.block_type === 'break' || block.block_type === 'routine' || block.block_type === 'sleep'

  return (
    <div
      role="article"
      className={`plan-block plan-block--${block.block_type}${isHabit ? ' is-habit' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 13,
        padding: isCompact ? '5px 14px' : '9px 14px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: isCurrent
          ? `linear-gradient(180deg, rgba(245,166,35,0.12), rgba(245,166,35,0.03))`
          : 'linear-gradient(180deg, var(--surface), var(--bg2))',
        border: isCurrent
          ? '1px solid rgba(245,166,35,0.38)'
          : '1px solid var(--border)',
        boxShadow: '0 1px 0 var(--border-lit) inset, 0 6px 18px rgba(0,0,0,.26)',
        opacity: isDone ? 0.42 : 1,
        transition: 'border-color .25s, box-shadow .2s',
      }}
    >
      {/* Content */}
      <div style={{ marginLeft: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'relative', zIndex: 2 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: isCompact ? 13 : 14.5, letterSpacing: '-.02em',
            display: 'flex', alignItems: 'baseline', gap: 8, overflow: 'hidden',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
              {format(new Date(block.start_time), 'h:mm a')}
            </span>
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: isMuted ? 'var(--text2)' : 'var(--text)',
              textDecoration: isDone ? 'line-through' : 'none',
              textDecorationColor: 'var(--text3)',
            }}>
              {block.label ?? block.block_type.replace(/_/g, ' ')}
            </span>
          </div>
          {!isCompact && block.description && (
            <div style={{ color: 'var(--text2)', fontSize: 12.5, marginTop: 2, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {block.description}
            </div>
          )}
        </div>

        {/* Badge */}
        {isCurrent ? (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.08em',
            textTransform: 'uppercase', padding: '3px 8px', borderRadius: 7,
            color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accent} 24%, transparent)`,
            flexShrink: 0,
          }}>now</span>
        ) : isHabit ? (
          <span className="habit-badge">
            {HABIT_REPEAT_ICON}
            habit
          </span>
        ) : block.task_id ? (
          <span className="plan-open-ic" style={{ color: 'var(--text3)', display: 'flex', flexShrink: 0 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        ) : null}
      </div>

      {/* Elapsed fill for current block */}
      {isCurrent && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0,
          height: `${Math.max(0, Math.min(100, (Date.now() - new Date(block.start_time).getTime()) / (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) * 100))}%`,
          background: 'linear-gradient(180deg, rgba(245,166,35,.18), rgba(245,166,35,.05))',
          pointerEvents: 'none', zIndex: 1,
        }} />
      )}
    </div>
  )
}
