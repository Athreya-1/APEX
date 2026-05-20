interface ProgressBarProps {
  value: number // 0–100
  color?: string
  height?: number
  className?: string
}

export function ProgressBar({ value, color = 'var(--amber)', height = 3, className }: ProgressBarProps) {
  return (
    <div className={className} style={{ width: '100%', height, background: 'var(--bg4)', borderRadius: height }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, Math.max(0, value))}%`,
        background: color,
        borderRadius: height,
        transition: 'width .3s ease',
      }} />
    </div>
  )
}
