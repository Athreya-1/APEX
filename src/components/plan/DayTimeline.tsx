'use client'
import { useMemo, useState } from 'react'
import { format, differenceInMinutes, isWithinInterval } from 'date-fns'
import Link from 'next/link'
import { PlanBlock as PlanBlockComponent } from './PlanBlock'
import type { PlanBlock as PlanBlockType, EisenhowerQuadrant } from '@/types'

interface DayTimelineProps {
  blocks: PlanBlockType[]
  onCheckin?: (blockId: string) => void
}

const SCALE = 1.5 // px per minute
const MIN_HEIGHT = 36

const EISENHOWER_LABELS: Record<EisenhowerQuadrant, string> = {
  urgent_important: 'Urgent + Important',
  not_urgent_important: 'Not urgent + Important',
  urgent_not_important: 'Urgent + Not important',
  neither: 'Neither',
}

function isUrgentQuadrant(q: EisenhowerQuadrant): boolean {
  return q === 'urgent_important' || q === 'urgent_not_important'
}

function formatDueChip(dueDate: string | null | undefined): string | null {
  if (!dueDate) return null
  return `due ${format(new Date(dueDate), 'EEE h:mma').replace(':00', '')}`
}

interface TaskDrawerProps {
  block: PlanBlockType
  onClose: () => void
}

function TaskDrawer({ block, onClose }: TaskDrawerProps) {
  const task = block.task
  const durationMins = differenceInMinutes(new Date(block.end_time), new Date(block.start_time))
  const estHours = task?.estimated_hours ?? task?.ai_estimated_hours ?? null
  const doneHours = task?.hours_elapsed ?? 0
  const progressPct = estHours ? Math.min(100, (doneHours / estHours) * 100) : 0
  const tagLabel = task?.course?.name ?? task?.topic ?? null
  const tagClass = task?.course ? 'course' : task?.topic ? 'project' : ''
  const eisenhower = task?.eisenhower_quadrant
  const dueChip = task ? formatDueChip(task.due_date) : null

  return (
    <>
      <div
        className="apex-scrim show"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(6,6,5,.5)', backdropFilter: 'blur(3px)',
        }}
      />
      <aside className="apex-drawer-panel" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '92vw', zIndex: 41,
        background: 'linear-gradient(180deg, var(--surface), var(--bg2))',
        borderLeft: '1px solid var(--border-lit)',
        boxShadow: '-30px 0 80px rgba(0,0,0,.5)',
        padding: '30px 28px',
        overflowY: 'auto',
        scrollbarWidth: 'none',
      }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 24, right: 24,
            width: 34, height: 34, borderRadius: 10,
            display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: 'var(--text2)',
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2)' }}>
          Task · from this block
        </div>
        <h2 style={{ fontWeight: 900, fontSize: 25, letterSpacing: -1, marginTop: 8, lineHeight: 1.1, paddingRight: 40 }}>
          {task?.task_name ?? block.label ?? block.block_type.replace(/_/g, ' ')}
        </h2>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {tagLabel && (
            <span className={`plan-dchip ${tagClass}`}>{tagLabel}</span>
          )}
          {task?.task_type_tag && (
            <span className="plan-dchip">{task.task_type_tag}</span>
          )}
          {dueChip && (
            <span className="plan-dchip">{dueChip}</span>
          )}
          {eisenhower && (
            <span className={`plan-dchip${isUrgentQuadrant(eisenhower) ? ' urgent' : ''}`}>
              {EISENHOWER_LABELS[eisenhower]}
            </span>
          )}
          {!task && (
            <>
              <span className="plan-dchip">
                {format(new Date(block.start_time), 'h:mm a')} – {format(new Date(block.end_time), 'h:mm a')}
              </span>
              <span className="plan-dchip">{durationMins}m</span>
              {block.status === 'done' && (
                <span className="plan-dchip" style={{ color: 'var(--green)', background: 'rgba(87,207,134,.12)', borderColor: 'rgba(87,207,134,.3)' }}>Done</span>
              )}
            </>
          )}
        </div>

        {task && (
          <>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 9 }}>Progress</div>
              <div style={{ height: 9, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--amber), var(--amber-soft))', borderRadius: 6 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', marginTop: 9 }}>
                <span>{doneHours}h done</span>
                <span>
                  est {estHours ?? '?'}h
                  {estHours != null && estHours > doneHours ? ` · ${(estHours - doneHours).toFixed(1)}h left` : ''}
                </span>
              </div>
            </div>
            {task.description && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 9 }}>Description</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text)' }}>{task.description}</div>
              </div>
            )}
            {typeof task.metadata?.planning_note === 'string' && task.metadata.planning_note && (
              <div className="plan-dnote">
                <svg className="ic" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v5M12 16h.01" />
                </svg>
                <span>{task.metadata.planning_note as string}</span>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, textAlign: 'center', padding: '12px 16px', borderRadius: 13, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Close
          </button>
          {task && (
            <Link
              href={`/todo?task=${task.id}`}
              style={{ flex: 1, textAlign: 'center', padding: '12px 16px', borderRadius: 13, border: 'none', background: 'linear-gradient(180deg,var(--amber),#e0941a)', color: '#1a1206', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}
            >
              Open in To-Do
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}

export function DayTimeline({ blocks, onCheckin }: DayTimelineProps) {
  const now = new Date()
  const [drawerBlock, setDrawerBlock] = useState<PlanBlockType | null>(null)

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [blocks],
  )

  const currentBlockId = useMemo(() => {
    const current = sortedBlocks.find((b) =>
      isWithinInterval(now, { start: new Date(b.start_time), end: new Date(b.end_time) }),
    )
    return current?.id ?? null
  }, [sortedBlocks]) // eslint-disable-line

  if (!sortedBlocks.length) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        No plan yet — generate one below
      </div>
    )
  }

  // Compute timeline bounds
  const dayStart = new Date(sortedBlocks[0].start_time)
  dayStart.setMinutes(0, 0, 0)
  const dayEnd = new Date(sortedBlocks[sortedBlocks.length - 1].end_time)

  const totalMins = differenceInMinutes(dayEnd, dayStart) || 60
  const timelineHeight = Math.max(totalMins * SCALE, 400)

  const yOf = (date: Date) => differenceInMinutes(date, dayStart) * SCALE

  // Hour labels
  const hours: Date[] = []
  const cursor = new Date(dayStart)
  cursor.setMinutes(0, 0, 0)
  while (cursor <= dayEnd) {
    hours.push(new Date(cursor))
    cursor.setHours(cursor.getHours() + 1)
  }

  const nowY = now >= dayStart && now <= dayEnd ? yOf(now) : null

  return (
    <>
      <div
        data-testid="day-timeline"
        style={{ position: 'relative', height: timelineHeight, margin: '0 0 40px' }}
      >
        {/* Hour gridlines */}
        {hours.map((h) => {
          const y = yOf(h)
          const fadeLabel = nowY !== null && Math.abs(y - nowY) < 13
          return (
            <div key={h.toISOString()} style={{ position: 'absolute', top: y, left: 0, right: 0 }}>
              <div style={{ position: 'absolute', left: 52, right: 0, height: 1, background: 'var(--border)' }} />
              <div className={fadeLabel ? 'hourlbl-fade' : undefined} style={{ position: 'absolute', left: 0, width: 48, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', transform: 'translateY(-50%)' }}>
                {format(h, 'h a')}
              </div>
            </div>
          )
        })}

        {/* Blocks */}
        {sortedBlocks.map((block) => {
          const top = yOf(new Date(block.start_time))
          const durationMins = differenceInMinutes(new Date(block.end_time), new Date(block.start_time))
          const height = Math.max(durationMins * SCALE - 4, MIN_HEIGHT)
          const isCurrent = block.id === currentBlockId

          return (
            <div
              key={block.id}
              style={{
                position: 'absolute',
                left: 62, right: 0,
                top, height,
              }}
              onClick={() => {
                if (block.task_id) setDrawerBlock(block)
                else onCheckin?.(block.id)
              }}
            >
              <PlanBlockComponent
                block={block}
                isCurrent={isCurrent}
              />
            </div>
          )
        })}

        {/* Now line */}
        {nowY !== null && (
          <div style={{
            position: 'absolute', left: 62, right: 0, top: nowY,
            height: 2, background: 'linear-gradient(90deg, var(--amber), rgba(245,166,35,.1))',
            pointerEvents: 'none', zIndex: 6,
          }}>
            <span style={{
              position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)',
              width: 9, height: 9, borderRadius: '50%', background: 'var(--amber)',
              boxShadow: '0 0 8px var(--amber)', display: 'block',
            }} />
            <span style={{
              position: 'absolute', left: -62, width: 48, top: '50%',
              transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)',
              fontSize: 11, fontWeight: 500, color: 'var(--amber)',
              textAlign: 'right', whiteSpace: 'nowrap',
            }}>
              {format(now, 'h:mm a')}
            </span>
          </div>
        )}
      </div>

      {drawerBlock && (
        <TaskDrawer block={drawerBlock} onClose={() => setDrawerBlock(null)} />
      )}
    </>
  )
}
