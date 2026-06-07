'use client'
import { useEffect, useState, useCallback, type CSSProperties } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Task, Habit, HabitLog, PlanBlock } from '@/types'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtShort(date: Date) {
  const h = date.getHours() % 12 || 12
  return `${h}:${String(date.getMinutes()).padStart(2, '0')}`
}

function fmtFocusMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

const FOCUS_BLOCK_TYPES = new Set(['deep_work', 'entrepreneur', 'cmr', 'admin'])

function tagStyle(tag: string, topic: string): CSSProperties {
  const t = tag.toLowerCase()
  const isProject = ['writeup', 'project', 'design', 'build'].includes(t) || topic.toLowerCase().includes('startup')
  if (isProject) return { color: 'var(--amber)', background: 'rgba(245,166,35,.12)' }
  return { color: 'var(--blue)', background: 'rgba(111,166,240,.12)' }
}

const BLOCK_COLOR: Record<string, string> = {
  deep_work: 'var(--amber)',
  entrepreneur: 'var(--amber-soft)',
  class: 'var(--blue)',
  meal: 'var(--green)',
  gym: 'var(--violet)',
  cmr: 'var(--pink)',
  creative: 'var(--amber-soft)',
  break: 'var(--text3)',
  routine: 'var(--text3)',
  sleep: 'var(--text3)',
  admin: 'var(--blue)',
  custom: 'var(--neutral)',
}

export default function HomePage() {
  const supabase = createClient()
  const [userName, setUserName] = useState('Athreya')
  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([])
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        supabase.from('users').select('display_name').eq('id', user.id).single()
          .then(({ data }) => { if (data?.display_name) setUserName(data.display_name) })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!userId) return
    const today = format(new Date(), 'yyyy-MM-dd')
    Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'done').order('urgency_score', { ascending: false }).limit(20),
      supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true),
      supabase.from('habit_logs').select('*').eq('user_id', userId).eq('logged_date', today),
      // Fetch today's plan blocks for the glance view
      supabase.from('daily_plans').select('id').eq('user_id', userId).eq('plan_date', today).single()
        .then(async ({ data: plan }) => {
          if (!plan) return []
          const { data } = await supabase
            .from('plan_blocks')
            .select('*')
            .eq('plan_id', plan.id)
            .order('start_time')
            .limit(8)
          return data ?? []
        }),
    ]).then(([{ data: taskData }, { data: habitData }, { data: logData }, blockData]) => {
      if (taskData) setTasks(taskData as Task[])
      if (habitData) setHabits(habitData as Habit[])
      if (logData) setHabitLogs(logData as HabitLog[])
      setPlanBlocks(blockData as PlanBlock[])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const today = format(new Date(), 'yyyy-MM-dd')
  const urgentTasks = tasks.filter((t) => t.urgency_score > 0.6)
  const thisWeekDeadlines = tasks.filter((t) => {
    if (!t.due_date) return false
    const diff = (new Date(t.due_date).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 7
  })
  const habitsCompletedToday = habitLogs.filter((l) => l.completed).length
  const mostUrgent = tasks[0]

  const now = new Date()
  const activeBlock = planBlocks.find(b => new Date(b.start_time) <= now && now <= new Date(b.end_time))
  const focusLeftMins = planBlocks
    .filter((b) => FOCUS_BLOCK_TYPES.has(b.block_type) && new Date(b.end_time) > now)
    .reduce((sum, b) => {
      const start = new Date(b.start_time) > now ? new Date(b.start_time) : now
      return sum + (new Date(b.end_time).getTime() - start.getTime()) / 60000
    }, 0)
  const focusBlockCount = planBlocks.filter((b) => FOCUS_BLOCK_TYPES.has(b.block_type)).length
  const subline = [
    activeBlock ? `${activeBlock.label ?? activeBlock.block_type.replace(/_/g, ' ')} is running now` : null,
    focusLeftMins > 0 ? `${fmtFocusMins(focusLeftMins)} of focus left` : null,
    thisWeekDeadlines.length ? `${thisWeekDeadlines.length} deadline${thisWeekDeadlines.length > 1 ? 's' : ''} this week` : null,
  ].filter(Boolean).join(' · ') || 'All caught up'

  const needsAttention = urgentTasks.slice(0, 3)

  const toggleHabit = useCallback(async (habitId: string) => {
    if (!userId) return
    const log = habitLogs.find((l) => l.habit_id === habitId && l.logged_date === today)
    if (log) {
      await supabase.from('habit_logs').delete().eq('id', log.id)
      setHabitLogs((prev) => prev.filter((l) => l.id !== log.id))
    } else {
      const { data } = await supabase.from('habit_logs').insert({
        habit_id: habitId, user_id: userId, logged_date: today, completed: true, source: 'manual',
      }).select().single()
      if (data) setHabitLogs((prev) => [...prev, data as HabitLog])
    }
  }, [userId, habitLogs, today, supabase])

  function dueDateLabel(isoDate: string | null | undefined): string {
    if (!isoDate) return '—'
    const diff = Math.round((new Date(isoDate).getTime() - Date.now()) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff > 1 && diff < 7) return format(new Date(isoDate), 'EEE')
    return format(new Date(isoDate), 'MMM d')
  }

  return (
    <main className="apex-main">
      {/* Header */}
      <div className="apex-eyebrow">{format(new Date(), 'EEEE · MMMM d')}</div>
      <h1 className="apex-h1">
        {getGreeting()}, <span style={{ color: 'var(--amber)' }}>{userName}.</span>
      </h1>
      <div style={{ color: 'var(--text2)', fontSize: 15, marginTop: 10 }}>{subline}</div>

      {/* 4-column stat grid — stagger-in animation */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 26,
      }}>
        {[
          { k: 'Focus left', v: focusLeftMins > 0 ? fmtFocusMins(focusLeftMins) : '—', s: focusBlockCount ? `across ${focusBlockCount} block${focusBlockCount > 1 ? 's' : ''}` : 'no plan yet' },
          { k: 'Open tasks', v: String(tasks.length), s: `${thisWeekDeadlines.length} due this week` },
          { k: 'Habits today', v: `${habitsCompletedToday} / ${habits.length}`, s: habits.filter((h) => !habitLogs.find((l) => l.habit_id === h.id && l.completed)).map((h) => h.name).slice(0, 2).join(' + ') || 'All done' },
          { k: 'Most urgent', v: mostUrgent ? mostUrgent.task_name : '—', s: mostUrgent?.due_date ? `due ${dueDateLabel(mostUrgent.due_date)}${mostUrgent.estimated_hours ? ` · padded ${mostUrgent.estimated_hours}h` : ''}` : 'no deadlines', urgent: !!mostUrgent },
        ].map(({ k, v, s, urgent }, i) => (
          <div key={k} style={{
            padding: 18, borderRadius: 18,
            background: urgent
              ? 'linear-gradient(180deg, rgba(245,166,35,0.12), rgba(245,166,35,0.03))'
              : 'linear-gradient(180deg,var(--surface),var(--bg2))',
            border: `1px solid ${urgent ? 'rgba(245,166,35,.32)' : 'var(--border)'}`,
            boxShadow: '0 1px 0 var(--border-lit) inset',
            animation: `stat-fade-in .6s var(--ease-out) ${i * 80 + 120}ms both`,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text2)' }}>{k}</div>
            <div style={{ fontWeight: 900, fontSize: urgent ? 18 : 30, letterSpacing: -1, marginTop: 10, lineHeight: 1.2 }}>{v}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      {/* 2-column row: Today glance + Needs attention */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginTop: 14 }}>
        {/* Today glance — plan blocks */}
        <div style={{ padding: 18, borderRadius: 18, background: 'linear-gradient(180deg,var(--surface),var(--bg2))', border: '1px solid var(--border)', boxShadow: '0 1px 0 var(--border-lit) inset' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 500 }}>Today</h3>
            <Link href="/plan" style={{ fontSize: 13, color: 'var(--amber)', textDecoration: 'none', fontWeight: 600 }}>Open planner →</Link>
          </div>
          {planBlocks.length > 0 ? planBlocks.slice(0, 5).map((block, idx, arr) => {
            const start = new Date(block.start_time)
            const now = new Date()
            const isNow = start <= now && now <= new Date(block.end_time)
            return (
              <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text3)', width: 52, flexShrink: 0 }}>
                  {fmtShort(start)}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: BLOCK_COLOR[block.block_type] ?? 'var(--text3)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 14.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isNow ? 'var(--amber)' : 'var(--text)' }}>
                  {block.label ?? block.block_type.replace(/_/g, ' ')}
                </span>
              </div>
            )
          }) : (
            <div style={{ padding: '11px 0', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              No plan yet —{' '}
              <Link href="/plan" style={{ color: 'var(--amber)', textDecoration: 'none' }}>generate your day</Link>
            </div>
          )}
        </div>

        {/* Needs attention */}
        <div style={{ padding: 18, borderRadius: 18, background: 'linear-gradient(180deg,var(--surface),var(--bg2))', border: '1px solid var(--border)', boxShadow: '0 1px 0 var(--border-lit) inset' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 500 }}>Needs attention</h3>
            <Link href="/tasks" style={{ fontSize: 13, color: 'var(--amber)', textDecoration: 'none', fontWeight: 600 }}>All tasks →</Link>
          </div>
          {needsAttention.length === 0 && (
            <div style={{ padding: '11px 0', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Nothing urgent right now.</div>
          )}
          {needsAttention.map((task, idx, arr) => {
            const due = dueDateLabel(task.due_date)
            const dueUrgent = task.due_date && (() => {
              const diff = Math.round((new Date(task.due_date).getTime() - Date.now()) / 86400000)
              return diff >= 0 && diff <= 5
            })()
            return (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, border: '1.6px solid var(--text3)', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.task_name}</span>
              {task.task_type_tag && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 7px', borderRadius: 6, ...tagStyle(task.task_type_tag, task.topic ?? '') }}>
                  {task.task_type_tag}
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: dueUrgent ? 'var(--red)' : 'var(--text2)' }}>{due}</span>
            </div>
            )
          })}
        </div>
      </div>

      {/* Full-width Habits today */}
      <div style={{ marginTop: 14 }}>
        <div style={{ padding: 18, borderRadius: 18, background: 'linear-gradient(180deg,var(--surface),var(--bg2))', border: '1px solid var(--border)', boxShadow: '0 1px 0 var(--border-lit) inset' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 500 }}>Habits today</h3>
            <Link href="/habits" style={{ fontSize: 13, color: 'var(--amber)', textDecoration: 'none', fontWeight: 600 }}>Manage →</Link>
          </div>
          {habits.length === 0 && (
            <div style={{ padding: '10px 0', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>No habits yet — <Link href="/habits" style={{ color: 'var(--amber)', textDecoration: 'none' }}>add your first</Link>.</div>
          )}
          {habits.map((habit) => {
            const done = habitLogs.some((l) => l.habit_id === habit.id && l.logged_date === today && l.completed)
            return (
              <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 15, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  {habit.icon || '✓'}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{habit.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{habit.target_frequency || 'daily'}</div>
                </div>
                <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
                  {[...Array(7)].map((_, i) => (
                    <i key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < 3 ? 'var(--green)' : 'var(--surface2)', display: 'block' }} />
                  ))}
                </div>
                <button
                  onClick={() => toggleHabit(habit.id)}
                  style={{
                    width: 24, height: 24, borderRadius: 7,
                    border: done ? 'none' : '1.6px solid var(--text3)',
                    background: done ? 'var(--green)' : 'none',
                    display: 'grid', placeItems: 'center', cursor: 'pointer',
                  }}
                >
                  {done && (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2.4}>
                      <path d="M5 12l5 5L20 6" stroke="#0a0a09" />
                    </svg>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
