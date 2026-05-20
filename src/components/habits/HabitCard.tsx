'use client'
import { StreakBar } from './StreakBar'
import type { Habit, HabitLog } from '@/types'

interface HabitCardProps {
  habit: Habit
  logs: HabitLog[]
  onToggle: (habitId: string) => void
  completedToday: boolean
}

function computeStreak(logs: HabitLog[]): number {
  const sorted = [...logs]
    .filter((l) => l.completed)
    .map((l) => l.logged_date)
    .sort()
    .reverse()

  let streak = 0
  let checkDate = new Date()
  checkDate.setHours(0, 0, 0, 0)

  for (const dateStr of sorted) {
    const logDate = new Date(dateStr)
    logDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((checkDate.getTime() - logDate.getTime()) / 86400000)
    if (diffDays === 0 || diffDays === 1) {
      streak++
      checkDate = logDate
    } else {
      break
    }
  }
  return streak
}

function compute30DayRate(logs: HabitLog[]): number {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - 30)
  const recent = logs.filter((l) => new Date(l.logged_date) >= threshold && l.completed)
  return Math.round((recent.length / 30) * 100)
}

export function HabitCard({ habit, logs, onToggle, completedToday }: HabitCardProps) {
  const streak = computeStreak(logs)
  const rate30 = compute30DayRate(logs)
  const completedDates = logs.filter((l) => l.completed).map((l) => l.logged_date)

  return (
    <div
      onClick={() => onToggle(habit.id)}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${completedToday ? 'rgba(245,166,35,.25)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color .15s, background .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{habit.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-.01em' }}>{habit.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
              {habit.target_frequency}
            </div>
          </div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: completedToday ? 'var(--green)' : 'var(--bg4)',
          border: `1px solid ${completedToday ? 'var(--green)' : 'var(--border2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .15s',
        }}>
          {completedToday && <span style={{ fontSize: 12, color: '#000' }}>✓</span>}
        </div>
      </div>

      <StreakBar completedDates={completedDates} days={14} />

      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{streak}</span> day streak
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
          <span style={{ color: 'var(--text2)' }}>{rate30}%</span> this month
        </div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
          <span style={{ color: 'var(--text2)' }}>{logs.filter((l) => l.completed).length}</span> total
        </div>
      </div>
    </div>
  )
}
