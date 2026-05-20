'use client'

interface TaskFilterPillsProps {
  filters: string[]
  active: string
  onSelect: (filter: string) => void
}

export function TaskFilters({ filters, active, onSelect }: TaskFilterPillsProps) {
  return (
    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
      {filters.map((filter) => {
        const isActive = filter === active
        return (
          <button
            key={filter}
            data-active={isActive}
            onClick={() => onSelect(filter)}
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '4px 10px',
              borderRadius: '20px',
              border: `1px solid ${isActive ? 'var(--amber-dim)' : 'var(--border2)'}`,
              background: isActive ? 'var(--amber-bg)' : 'transparent',
              color: isActive ? 'var(--amber)' : 'var(--text2)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all .15s',
            }}
          >
            {filter}
          </button>
        )
      })}
    </div>
  )
}
