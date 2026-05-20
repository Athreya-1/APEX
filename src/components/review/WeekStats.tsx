'use client'

interface WeekStatsProps {
  tasksCompleted: number
  estimateAccuracy: number // 0-100
  deepWorkHours: number
}

export function WeekStats({ tasksCompleted, estimateAccuracy, deepWorkHours }: WeekStatsProps) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
      {[
        { label: 'Tasks done', value: String(tasksCompleted), color: 'var(--green)' },
        { label: 'Est. accuracy', value: `${estimateAccuracy}%`, color: estimateAccuracy >= 80 ? 'var(--green)' : estimateAccuracy >= 60 ? 'var(--amber)' : 'var(--red)' },
        { label: 'Deep work', value: `${deepWorkHours}h`, color: 'var(--amber)' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ flex: 1, padding: '12px 16px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: '-.02em' }}>{value}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
