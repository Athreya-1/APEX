import { render, screen } from '@testing-library/react'

describe('WeekStats', () => {
  it('renders three stats', async () => {
    const { WeekStats } = await import('@/components/review/WeekStats')
    render(<WeekStats tasksCompleted={5} estimateAccuracy={78} deepWorkHours={12.5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    expect(screen.getByText('12.5h')).toBeInTheDocument()
  })
})

describe('ApexInsight', () => {
  it('renders insight text', async () => {
    const { ApexInsight } = await import('@/components/review/ApexInsight')
    render(<ApexInsight insight="Great week overall!" />)
    expect(screen.getByText('Great week overall!')).toBeInTheDocument()
  })
})

describe('TopicRow', () => {
  const topic = {
    id: 't1', exam_plan_id: 'e1', topic_name: 'Virtual Memory',
    sort_order: 0, estimated_hours: 2, actual_hours: null,
    confidence_level: 3, needs_practice: false,
    status: 'not_started' as const,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }

  it('renders topic name', async () => {
    const { TopicRow } = await import('@/components/exams/TopicRow')
    render(<TopicRow topic={topic} />)
    expect(screen.getByText('Virtual Memory')).toBeInTheDocument()
  })

  it('renders 5 confidence dots', async () => {
    const { TopicRow } = await import('@/components/exams/TopicRow')
    const { container } = render(<TopicRow topic={topic} />)
    const dots = container.querySelectorAll('[style*="border-radius: 50%"]')
    expect(dots.length).toBeGreaterThanOrEqual(5)
  })
})
