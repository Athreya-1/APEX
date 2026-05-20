interface BadgeProps {
  label: string
  color?: string // CSS var string like 'var(--amber)'
  size?: 'sm' | 'md'
}

export function Badge({ label, color = 'var(--amber)', size = 'sm' }: BadgeProps) {
  const bg = `${color}22` // ~13% opacity via hex
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: size === 'sm' ? '2px 7px' : '3px 10px',
      borderRadius: 20,
      background: bg,
      border: `1px solid ${color}44`,
      color,
      fontSize: size === 'sm' ? 9 : 11,
      fontFamily: 'var(--font-mono)',
      letterSpacing: '.04em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
