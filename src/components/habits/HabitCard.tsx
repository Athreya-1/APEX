'use client'
import { format } from 'date-fns'
import type { Habit, HabitLog } from '@/types'

interface HabitCardProps {
  habit: Habit
  logs: HabitLog[]
  onToggle: (habitId: string, completed: boolean) => void
  accentColor?: string
}

function computeStreak(habitId: string, logs: HabitLog[]): number {
  let streak = 0
  const check = new Date()
  check.setHours(0, 0, 0, 0)
  while (logs.some((l) => l.habit_id === habitId && l.logged_date === format(check, 'yyyy-MM-dd') && l.completed)) {
    streak++
    check.setDate(check.getDate() - 1)
  }
  return streak
}

function compute30DayRate(habitId: string, logs: HabitLog[]): number {
  const thirtyAgo = format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd')
  const relevant = logs.filter((l) => l.habit_id === habitId && l.logged_date >= thirtyAgo && l.completed)
  return Math.round((relevant.length / 30) * 100)
}

export function getStreakDots(habitId: string, logs: HabitLog[], count = 14): boolean[] {
  const dots: boolean[] = []
  const check = new Date()
  check.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const iso = format(check, 'yyyy-MM-dd')
    dots.unshift(logs.some((l) => l.habit_id === habitId && l.logged_date === iso && l.completed))
    check.setDate(check.getDate() - 1)
  }
  return dots
}

function formatFrequency(habit: Habit): string {
  const ft = habit.frequency_type ?? 'daily'
  if (ft === 'per_week') return `${habit.frequency_target ?? 1}× / week`
  if (ft === 'daily') return 'daily'
  return habit.target_frequency || ft
}

export function HabitCard({ habit, logs, onToggle, accentColor }: HabitCardProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const doneToday = logs.some((l) => l.habit_id === habit.id && l.logged_date === today && l.completed)
  const streak = computeStreak(habit.id, logs)
  const rate30 = compute30DayRate(habit.id, logs)
  const dots = getStreakDots(habit.id, logs)
  const modeLabel = habit.mode === 'time_blocked' ? 'time-blocked' : 'check-off'
  const isGreen = habit.mode !== 'time_blocked'
  const color = accentColor ?? habit.color ?? 'var(--amber)'

  return (
    <div className="hcard">
      <div className="hcard-top">
        <span className="hic">{habit.icon || '🎯'}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {habit.name}
            <span className="badge-mode">{modeLabel}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>
            {formatFrequency(habit)}
            {habit.mode === 'time_blocked' && habit.duration_mins ? ` · ${habit.duration_mins}m` : ''}
            {habit.notification_time ? ` · notify ${habit.notification_time}` : ''}
          </div>
        </div>
        <button
          type="button"
          className={`hcheck${doneToday ? ' done' : ''}`}
          onClick={() => onToggle(habit.id, !doneToday)}
          aria-label={doneToday ? 'Mark incomplete' : 'Mark complete'}
        >
          <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12l5 5L20 6" /></svg>
        </button>
      </div>
      <div className="streakdots">
        {dots.map((on, i) => (
          <i key={i} className={on ? `on${isGreen ? ' g' : ''}` : ''} style={{ background: on && !isGreen ? color : undefined }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
        <span><b style={{ color: 'var(--text)', fontWeight: 500 }}>{streak}</b> day streak</span>
        <span><b style={{ color: 'var(--text)', fontWeight: 500 }}>{rate30}%</b> 30d</span>
      </div>
    </div>
  )
}
