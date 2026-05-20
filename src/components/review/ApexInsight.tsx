'use client'

interface ApexInsightProps {
  insight: string
  isLoading?: boolean
}

export function ApexInsight({ insight, isLoading }: ApexInsightProps) {
  return (
    <div style={{
      background: 'var(--amber-bg)', border: '1px solid var(--amber-dim)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
        APEX insight
      </div>
      {isLoading ? (
        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Analyzing your week…</div>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>{insight}</div>
      )}
    </div>
  )
}
