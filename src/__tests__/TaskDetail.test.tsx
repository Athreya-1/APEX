import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

jest.useFakeTimers()

const mockUpdateField = jest.fn().mockResolvedValue(undefined)
const mockOnComplete = jest.fn()
const mockOnClose = jest.fn()

const baseTask = {
  id: 'task-1',
  task_name: 'Lab 4 — Cache simulator',
  topic: '15-213',
  task_type_tag: 'lab',
  status: 'pending' as const,
  urgency_score: 0.82,
  estimated_hours: 4,
  due_date: '2026-05-17T23:59:00.000Z',
  do_date: '2026-05-13',
  eisenhower_quadrant: 'urgent_important',
  description: 'Part A: cache simulator.',
  user_id: 'user-1',
} as any

describe('TaskDetail', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders task name', async () => {
    const { TaskDetail } = await import('@/components/tasks/TaskDetail')
    render(<TaskDetail task={baseTask} onUpdateField={mockUpdateField} onComplete={mockOnComplete} onClose={mockOnClose} />)
    expect(screen.getByDisplayValue('Lab 4 — Cache simulator')).toBeInTheDocument()
  })

  it('renders urgency score', async () => {
    const { TaskDetail } = await import('@/components/tasks/TaskDetail')
    render(<TaskDetail task={baseTask} onUpdateField={mockUpdateField} onComplete={mockOnComplete} onClose={mockOnClose} />)
    expect(screen.getByText(/0.82/)).toBeInTheDocument()
  })

  it('renders Mark done button', async () => {
    const { TaskDetail } = await import('@/components/tasks/TaskDetail')
    render(<TaskDetail task={baseTask} onUpdateField={mockUpdateField} onComplete={mockOnComplete} onClose={mockOnClose} />)
    expect(screen.getByRole('button', { name: /mark done/i })).toBeInTheDocument()
  })

  it('calls onComplete when Mark done is clicked', async () => {
    const { TaskDetail } = await import('@/components/tasks/TaskDetail')
    render(<TaskDetail task={baseTask} onUpdateField={mockUpdateField} onComplete={mockOnComplete} onClose={mockOnClose} />)
    fireEvent.click(screen.getByRole('button', { name: /mark done/i }))
    expect(mockOnComplete).toHaveBeenCalledWith('task-1')
  })

  it('calls onUpdateField with debounce when estimate hours changes', async () => {
    const { TaskDetail } = await import('@/components/tasks/TaskDetail')
    render(<TaskDetail task={baseTask} onUpdateField={mockUpdateField} onComplete={mockOnComplete} onClose={mockOnClose} />)
    const estInput = screen.getByLabelText('Estimated hours')
    fireEvent.change(estInput, { target: { value: '5' } })
    expect(mockUpdateField).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(500))
    await waitFor(() => expect(mockUpdateField).toHaveBeenCalledWith('task-1', 'estimated_hours', 5))
  })
})
