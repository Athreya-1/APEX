import { render, screen, fireEvent, act } from '@testing-library/react'

const mockBlock = {
  id: 'block-1',
  plan_id: 'plan-1',
  task_id: null,
  block_type: 'deep_work' as const,
  start_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  label: 'Lab 4 — Cache Simulator',
  description: '15-213 · lab',
  gcal_event_id: null,
  original_start_time: null,
  original_end_time: null,
  cognitive_class: null,
  status: 'scheduled' as const,
  checkin_done_at: null,
  checkin_response: null,
  sort_order: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('PlanBlock', () => {
  it('renders block label', async () => {
    const { PlanBlock } = await import('@/components/plan/PlanBlock')
    render(<PlanBlock block={mockBlock} isCurrent={false} />)
    expect(screen.getByText('Lab 4 — Cache Simulator')).toBeInTheDocument()
  })

  it('shows now badge when current', async () => {
    const { PlanBlock } = await import('@/components/plan/PlanBlock')
    render(<PlanBlock block={mockBlock} isCurrent={true} />)
    expect(screen.getByText(/now/i)).toBeInTheDocument()
  })

  it('does not show a badge for non-current deep_work blocks', async () => {
    const { PlanBlock } = await import('@/components/plan/PlanBlock')
    render(<PlanBlock block={mockBlock} isCurrent={false} />)
    // New design uses a chevron arrow for task-linked blocks, no text badge
    expect(screen.queryByText('DEEP')).not.toBeInTheDocument()
  })
})

describe('DayTimeline', () => {
  it('renders all blocks', async () => {
    const { DayTimeline } = await import('@/components/plan/DayTimeline')
    const blocks = [mockBlock, { ...mockBlock, id: 'block-2', label: 'Break', block_type: 'break' as const }]
    render(<DayTimeline blocks={blocks} />)
    expect(screen.getByText('Lab 4 — Cache Simulator')).toBeInTheDocument()
    expect(screen.getByText('Break')).toBeInTheDocument()
  })

  it('shows empty state when no blocks', async () => {
    const { DayTimeline } = await import('@/components/plan/DayTimeline')
    render(<DayTimeline blocks={[]} />)
    expect(screen.getByText(/no plan yet/i)).toBeInTheDocument()
  })
})

describe('CheckInBanner', () => {
  it('renders the block label in question', async () => {
    const { CheckInBanner } = await import('@/components/plan/CheckInBanner')
    render(<CheckInBanner block={mockBlock} onResponse={jest.fn()} />)
    expect(screen.getByText('Lab 4 — Cache Simulator')).toBeInTheDocument()
  })

  it('renders Done button as primary', async () => {
    const { CheckInBanner } = await import('@/components/plan/CheckInBanner')
    render(<CheckInBanner block={mockBlock} onResponse={jest.fn()} />)
    expect(screen.getByText('done')).toBeInTheDocument()
  })

  it('calls onResponse with done when Done is clicked', async () => {
    const onResponse = jest.fn().mockResolvedValue(undefined)
    const { CheckInBanner } = await import('@/components/plan/CheckInBanner')
    render(<CheckInBanner block={mockBlock} onResponse={onResponse} />)
    await act(async () => {
      fireEvent.click(screen.getByText('done'))
    })
    expect(onResponse).toHaveBeenCalledWith('block-1', 'done', undefined)
  })
})
