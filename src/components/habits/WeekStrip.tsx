'use client'
import { format, startOfWeek, addDays, isToday } from 'date-fns'
import type { Habit, HabitLog, Goal } from '@/types'

export interface TrackItem {
  id: string
  label: string
  kind: 'goal' | 'habit'
  weight: number
  color: string
  habitIds: string[]
}

interface WeekStripProps {
  trackItems: TrackItem[]
  logs: HabitLog[]
}

const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function isTrackItemDone(item: TrackItem, iso: string, logs: HabitLog[]): boolean {
  if (item.habitIds.length === 0) return false
  return item.habitIds.every((hid) =>
    logs.some((l) => l.habit_id === hid && l.logged_date === iso && l.completed),
  )
}

export function buildTrackItems(
  goals: Goal[],
  habits: Habit[],
  goalColors: string[],
  habitColors: string[],
): TrackItem[] {
  const items: TrackItem[] = []
  goals.forEach((g, gi) => {
    const linked = habits.filter((h) => h.goal_id === g.id)
    if (linked.length === 0) return
    items.push({
      id: g.id,
      label: g.name,
      kind: 'goal',
      weight: linked.length,
      color: g.color || goalColors[gi % goalColors.length],
      habitIds: linked.map((h) => h.id),
    })
  })
  habits
    .filter((h) => !h.goal_id)
    .forEach((h, hi) => {
      items.push({
        id: h.id,
        label: h.name,
        kind: 'habit',
        weight: 1,
        color: h.color || habitColors[hi % habitColors.length],
        habitIds: [h.id],
      })
    })
  return items
}

export function WeekStrip({ trackItems, logs }: WeekStripProps) {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  return (
    <div className="habit-weekstrip">
      {weekDates.map((date, i) => {
        const iso = format(date, 'yyyy-MM-dd')
        const today = isToday(date)
        return (
          <div key={iso} className={`habit-day${today ? ' today' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text3)', letterSpacing: '.12em' }}>
                {WEEK_DAYS[i]}
              </span>
              <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.3, color: today ? 'var(--amber)' : 'var(--text)' }}>
                {format(date, 'd')}
              </span>
            </div>
            <div className="habit-ddots">
              {trackItems.length === 0 ? (
                <i />
              ) : (
                trackItems.map((item) => {
                  const on = isTrackItemDone(item, iso, logs)
                  return (
                    <i
                      key={item.id}
                      title={item.label}
                      style={{ flex: item.weight, background: on ? item.color : undefined }}
                    />
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface WeekLegendProps {
  trackItems: TrackItem[]
}

export function WeekLegend({ trackItems }: WeekLegendProps) {
  if (trackItems.length === 0) return null
  return (
    <div className="weeklegend">
      {trackItems.map((item) => (
        <span key={item.id} className="weeklegend-item">
          <span className="weeklegend-sw" style={{ background: item.color }} />
          {item.label}
          {item.kind === 'goal' && (
            <span className="weeklegend-gk">goal ×{item.weight}</span>
          )}
        </span>
      ))}
      <span className="weeklegend-note">goal segment lights only when all its habits are done</span>
    </div>
  )
}
