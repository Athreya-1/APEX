import { render, screen } from '@testing-library/react'

const mockHabit = {
  id: 'h1', user_id: 'u1', name: 'Gym', icon: '🏋️',
  color: '#f5a623', target_frequency: 'daily' as const,
  target_days: null, is_active: true, sort_order: 0,
  mode: 'time_blocked' as const, duration_mins: 90,
  frequency_type: 'per_week' as const, frequency_target: 3,
  time_ranges: null, goal_id: null, notification_time: null,
  cognitive_class: 'physical',
  created_at: new Date().toISOString(),
}

const mockLogs = [
  { id: 'l1', habit_id: 'h1', user_id: 'u1', logged_date: new Date().toISOString().slice(0, 10),
    completed: true, note: null, source: 'manual' as const, created_at: new Date().toISOString() },
]

describe('HabitCard', () => {
  it('renders habit name', async () => {
    const { HabitCard } = await import('@/components/habits/HabitCard')
    render(<HabitCard habit={mockHabit} logs={mockLogs} onToggle={jest.fn()} completedToday={true} />)
    expect(screen.getByText('Gym')).toBeInTheDocument()
  })

  it('shows checkmark when completed today', async () => {
    const { HabitCard } = await import('@/components/habits/HabitCard')
    render(<HabitCard habit={mockHabit} logs={mockLogs} onToggle={jest.fn()} completedToday={true} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})

describe('WeekStrip', () => {
  it('renders 7 day circles', async () => {
    const { WeekStrip } = await import('@/components/habits/WeekStrip')
    render(<WeekStrip completedDates={[]} />)
    // 7 day labels
    const labels = screen.getAllByText(/^[MTWTFSS]$/)
    expect(labels.length).toBe(7)
  })
})

describe('StreakBar', () => {
  it('renders correct number of dots', async () => {
    const { StreakBar } = await import('@/components/habits/StreakBar')
    const { container } = render(<StreakBar completedDates={[]} days={14} />)
    const dots = container.querySelectorAll('div > div > div')
    expect(dots.length).toBe(14)
  })
})
