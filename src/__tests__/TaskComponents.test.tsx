import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next/navigation', () => ({ usePathname: () => '/tasks' }))

// ── TaskFilters tests ──
describe('TaskFilters', () => {
  const filters = ['All', '15-213', 'CMR', 'Urgent']

  it('renders all filter pills', async () => {
    const { TaskFilters } = await import('@/components/tasks/TaskFilters')
    render(<TaskFilters filters={filters} active="All" onSelect={jest.fn()} />)
    filters.forEach((f) => expect(screen.getByText(f)).toBeInTheDocument())
  })

  it('marks active filter with data-active attribute', async () => {
    const { TaskFilters } = await import('@/components/tasks/TaskFilters')
    render(<TaskFilters filters={filters} active="All" onSelect={jest.fn()} />)
    expect(screen.getByText('All').closest('button')).toHaveAttribute('data-active', 'true')
  })

  it('calls onSelect when a pill is clicked', async () => {
    const onSelect = jest.fn()
    const { TaskFilters } = await import('@/components/tasks/TaskFilters')
    render(<TaskFilters filters={filters} active="All" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('15-213'))
    expect(onSelect).toHaveBeenCalledWith('15-213')
  })
})

// ── TaskRow tests ──
describe('TaskRow', () => {
  const task = {
    id: 'task-1',
    task_name: 'Lab 4 — Cache simulator',
    status: 'pending' as const,
    urgency_score: 0.82,
    estimated_hours: 4,
    due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    do_date: null,
    topic: '15-213',
    task_type_tag: 'lab',
    course: { name: '15-213', color: '#f87171' },
    user_id: 'user-1',
    description: null,
  } as any

  it('renders task name', async () => {
    const { TaskRow } = await import('@/components/tasks/TaskRow')
    render(<TaskRow task={task} onComplete={jest.fn()} onSelect={jest.fn()} isSelected={false} />)
    expect(screen.getByText('Lab 4 — Cache simulator')).toBeInTheDocument()
  })

  it('renders urgency bar', async () => {
    const { TaskRow } = await import('@/components/tasks/TaskRow')
    render(<TaskRow task={task} onComplete={jest.fn()} onSelect={jest.fn()} isSelected={false} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('calls onComplete when checkbox is clicked', async () => {
    const onComplete = jest.fn()
    const { TaskRow } = await import('@/components/tasks/TaskRow')
    render(<TaskRow task={task} onComplete={onComplete} onSelect={jest.fn()} isSelected={false} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onComplete).toHaveBeenCalledWith('task-1')
  })

  it('calls onSelect when row body is clicked', async () => {
    const onSelect = jest.fn()
    const { TaskRow } = await import('@/components/tasks/TaskRow')
    render(<TaskRow task={task} onComplete={jest.fn()} onSelect={onSelect} isSelected={false} />)
    fireEvent.click(screen.getByText('Lab 4 — Cache simulator'))
    expect(onSelect).toHaveBeenCalledWith('task-1')
  })
})

// ── TaskList tests ──
describe('TaskList', () => {
  const tasks = [
    {
      id: '1', task_name: 'Urgent Task', status: 'pending' as const, urgency_score: 0.8,
      due_date: new Date(Date.now() + 1000000).toISOString(), do_date: null,
      topic: '15-213', task_type_tag: 'lab', estimated_hours: 3, user_id: 'u',
      description: null,
    } as any,
    {
      id: '2', task_name: 'Done Task', status: 'done' as const, urgency_score: 0,
      due_date: null, do_date: null, topic: 'CMR', task_type_tag: 'other',
      estimated_hours: 1, user_id: 'u', description: null,
    } as any,
  ]

  it('renders urgent group label', async () => {
    const { TaskList } = await import('@/components/tasks/TaskList')
    render(<TaskList tasks={tasks} onComplete={jest.fn()} onSelectTask={jest.fn()} selectedTaskId={null} />)
    expect(screen.getAllByText(/urgent/i).length).toBeGreaterThan(0)
  })

  it('renders completed group label', async () => {
    const { TaskList } = await import('@/components/tasks/TaskList')
    render(<TaskList tasks={tasks} onComplete={jest.fn()} onSelectTask={jest.fn()} selectedTaskId={null} />)
    expect(screen.getByText(/completed/i)).toBeInTheDocument()
  })

  it('renders all task names', async () => {
    const { TaskList } = await import('@/components/tasks/TaskList')
    render(<TaskList tasks={tasks} onComplete={jest.fn()} onSelectTask={jest.fn()} selectedTaskId={null} />)
    expect(screen.getByText('Urgent Task')).toBeInTheDocument()
    expect(screen.getByText('Done Task')).toBeInTheDocument()
  })
})
