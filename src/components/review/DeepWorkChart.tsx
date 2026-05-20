'use client'
import { format } from 'date-fns'

interface DeepWorkChartProps {
  data: Array<{ date: string; hours: number }> // 7 days
}

export function DeepWorkChart({ data }: DeepWorkChartProps) {
  const maxHours = Math.max(...data.map((d) => d.hours), 1)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
        Deep work (7 days)
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
        {data.map((d, i) => {
          const isFuture = new Date(d.date) > new Date()
          const heightPct = (d.hours / maxHours) * 100
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', height: `${heightPct || 4}%`, background: isFuture ? 'var(--bg4)' : 'var(--amber)',
                borderRadius: '3px 3px 0 0', minHeight: 4,
                opacity: isFuture ? 0.3 : 1,
              }} />
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
                {format(new Date(d.date), 'EEE')[0]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
