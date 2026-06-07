import { render, screen } from '@testing-library/react'
import { format } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')

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
  { id: 'l1', habit_id: 'h1', user_id: 'u1', logged_date: today,
    completed: true, note: null, source: 'manual' as const, created_at: new Date().toISOString() },
]

describe('HabitCard', () => {
  it('renders habit name', async () => {
    const { HabitCard } = await import('@/components/habits/HabitCard')
    render(<HabitCard habit={mockHabit} logs={mockLogs} onToggle={jest.fn()} />)
    expect(screen.getByText('Gym')).toBeInTheDocument()
  })

  it('shows done state when completed today', async () => {
    const { HabitCard } = await import('@/components/habits/HabitCard')
    render(<HabitCard habit={mockHabit} logs={mockLogs} onToggle={jest.fn()} />)
    expect(screen.getByLabelText('Mark incomplete')).toBeInTheDocument()
  })
})

describe('WeekStrip', () => {
  it('renders 7 day columns', async () => {
    const { WeekStrip } = await import('@/components/habits/WeekStrip')
    const { container } = render(
      <WeekStrip
        trackItems={[{ id: 'h1', label: 'Gym', kind: 'habit', weight: 1, color: 'var(--amber)', habitIds: ['h1'] }]}
        logs={[]}
      />,
    )
    expect(container.querySelectorAll('.habit-day').length).toBe(7)
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

describe('DecompModal', () => {
  it('renders input when open', async () => {
    const { DecompModal } = await import('@/components/habits/DecompModal')
    render(<DecompModal open onClose={jest.fn()} onConfirm={jest.fn()} />)
    expect(screen.getByPlaceholderText(/LeetCode/i)).toBeInTheDocument()
  })
})
