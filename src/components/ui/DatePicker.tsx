interface DatePickerProps {
  value: string | null // YYYY-MM-DD or YYYY-MM-DDTHH:MM
  onChange: (value: string) => void
  includeTime?: boolean
  placeholder?: string
  disabled?: boolean
}

export function DatePicker({ value, onChange, includeTime, placeholder, disabled }: DatePickerProps) {
  const inputType = includeTime ? 'datetime-local' : 'date'
  return (
    <input
      type={inputType}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '6px 10px',
        background: 'var(--bg3)',
        border: '1px solid var(--border2)',
        borderRadius: 7,
        color: value ? 'var(--text)' : 'var(--text3)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        outline: 'none',
        colorScheme: 'dark',
        boxSizing: 'border-box' as const,
      }}
    />
  )
}
