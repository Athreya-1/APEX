'use client'
import { format, startOfWeek, addDays, isToday } from 'date-fns'

interface WeekStripProps {
  completedDates: string[] // YYYY-MM-DD strings
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function WeekStrip({ completedDates }: WeekStripProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '12px 0' }}>
      {days.map((day, i) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const isDone = completedDates.includes(dateStr)
        const isTodayDay = isToday(day)
        const isPast = day < new Date() && !isToday(day)

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text3)', textTransform: 'uppercase' }}>
              {DAY_LABELS[i]}
            </span>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: isDone ? 'var(--amber)' : 'transparent',
              border: `1px solid ${isTodayDay && !isDone ? 'var(--amber)' : isDone ? 'var(--amber)' : 'var(--border2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: isPast && !isDone ? 0.4 : 1,
            }}>
              {isDone && <span style={{ fontSize: 11, color: '#000' }}>✓</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
