'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { UniversalInput } from '@/components/input/UniversalInput'
import type { Task, Habit, HabitLog } from '@/types'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const supabase = createClient()
  const [userName, setUserName] = useState<string>('Athreya')
  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        // Get display name
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
    ]).then(([{ data: taskData }, { data: habitData }, { data: logData }]) => {
      if (taskData) setTasks(taskData as Task[])
      if (habitData) setHabits(habitData as Habit[])
      if (logData) setHabitLogs(logData as HabitLog[])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const urgentTasks = tasks.filter((t) => t.urgency_score > 0.6)
  const thisWeekDeadlines = tasks.filter((t) => {
    if (!t.due_date) return false
    const diff = (new Date(t.due_date).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 7
  })
  const habitsCompletedToday = habitLogs.filter((l) => l.completed).length
  const mostUrgent = tasks[0]

  const subline = [
    thisWeekDeadlines.length ? `${thisWeekDeadlines.length} deadline${thisWeekDeadlines.length > 1 ? 's' : ''} this week` : null,
    mostUrgent ? `${mostUrgent.task_name} needs attention` : null,
  ].filter(Boolean).join(' · ') || 'All caught up'

  const stats = [
    { label: 'Open tasks', value: String(tasks.length), color: 'var(--text)' },
    { label: 'Urgent', value: String(urgentTasks.length), color: urgentTasks.length > 0 ? 'var(--red)' : 'var(--green)' },
    { label: 'Habits today', value: `${habitsCompletedToday}/${habits.length}`, color: 'var(--green)' },
    { label: 'Most urgent', value: mostUrgent ? mostUrgent.urgency_score.toFixed(2) : '—', color: 'var(--amber)' },
  ]

  const handleInput = async (input: string) => {
    await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context: { user_name: userName } }),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.03em', marginBottom: 4 }}>
          {getGreeting()}, <span style={{ color: 'var(--amber)' }}>{userName}.</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
          {subline}
        </div>
      </div>

      {/* 2×2 stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px 16px', flexShrink: 0 }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-.02em' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Urgent strip */}
      {urgentTasks.length > 0 && (
        <div style={{ padding: '0 16px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
            Urgent
          </div>
          {urgentTasks.slice(0, 3).map((task) => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.task_name}
              </div>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                {task.urgency_score.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Universal input */}
      <div style={{ padding: '8px 16px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <UniversalInput placeholder="Ask APEX anything…" onSubmit={handleInput} />
      </div>
    </div>
  )
}
