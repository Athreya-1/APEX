'use client'
import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { HabitCard } from '@/components/habits/HabitCard'
import { WeekStrip } from '@/components/habits/WeekStrip'
import { UniversalInput } from '@/components/input/UniversalInput'
import type { Habit, HabitLog } from '@/types'

export default function HabitsPage() {
  const supabase = createClient()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [userId, setUserId] = useState<string | undefined>()
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    if (!userId) return

    Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order'),
      supabase.from('habit_logs').select('*').eq('user_id', userId).gte('logged_date', format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd')),
    ]).then(([{ data: habitData }, { data: logData }]) => {
      if (habitData) setHabits(habitData)
      if (logData) setLogs(logData)
    })
  }, [userId])

  const toggleHabit = useCallback(async (habitId: string) => {
    if (!userId) return
    const todayLog = logs.find((l) => l.habit_id === habitId && l.logged_date === today)

    if (todayLog) {
      await supabase.from('habit_logs').delete().eq('id', todayLog.id)
      setLogs((prev) => prev.filter((l) => l.id !== todayLog.id))
    } else {
      const { data } = await supabase.from('habit_logs').insert({
        habit_id: habitId,
        user_id: userId,
        logged_date: today,
        completed: true,
        source: 'manual',
      }).select().single()
      if (data) setLogs((prev) => [...prev, data as HabitLog])
    }
  }, [userId, logs, today])

  const allCompletedDates = [...new Set(logs.filter((l) => l.completed).map((l) => l.logged_date))]

  const overallStreak = (() => {
    let streak = 0
    let check = new Date()
    check.setHours(0, 0, 0, 0)
    while (allCompletedDates.includes(format(check, 'yyyy-MM-dd'))) {
      streak++
      check = new Date(check.getTime() - 86400000)
    }
    return streak
  })()

  const handleInput = useCallback(async (input: string) => {
    if (!userId) return
    await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context: { user_name: 'Athreya', habits: habits.map((h) => ({ name: h.name })) } }),
    })
  }, [userId, habits])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>Habits</span>
          {overallStreak > 0 && (
            <div style={{
              padding: '4px 10px', borderRadius: 20, background: 'var(--amber)',
              color: '#000', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
            }}>
              🔥 {overallStreak} day streak
            </div>
          )}
        </div>
        <WeekStrip completedDates={allCompletedDates} />
      </div>

      {/* Habit list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'none' }}>
        {habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            logs={logs.filter((l) => l.habit_id === habit.id)}
            onToggle={toggleHabit}
            completedToday={logs.some((l) => l.habit_id === habit.id && l.logged_date === today && l.completed)}
          />
        ))}

        {/* Add habit button */}
        <div style={{
          border: '1px dashed var(--border2)', borderRadius: 12,
          padding: '16px', textAlign: 'center',
          cursor: 'pointer', color: 'var(--text3)',
          fontSize: 12, fontFamily: 'var(--font-mono)',
        }}>
          + Add habit
        </div>
      </div>

      {/* Universal input */}
      <div style={{ padding: '8px 16px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <UniversalInput
          placeholder="Log a habit or ask about your streaks…"
          onSubmit={handleInput}
        />
      </div>
    </div>
  )
}
