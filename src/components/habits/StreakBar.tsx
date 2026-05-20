'use client'
import { format, subDays, isToday } from 'date-fns'

interface StreakBarProps {
  completedDates: string[] // YYYY-MM-DD
  days?: number
}

export function StreakBar({ completedDates, days = 14 }: StreakBarProps) {
  const dots = Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - 1 - i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const isDone = completedDates.includes(dateStr)
    const isToday_ = isToday(date)
    return { dateStr, isDone, isToday: isToday_ }
  })

  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {dots.map(({ dateStr, isDone, isToday: isTodayDot }) => (
        <div
          key={dateStr}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isDone
              ? 'var(--green)'
              : isTodayDot
                ? 'var(--amber)'
                : 'var(--bg4)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}
