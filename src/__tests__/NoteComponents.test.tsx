import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useParams: () => ({ padId: 'pad-1' }),
  useRouter: () => ({ back: jest.fn() }),
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: any) => <a href={href}>{children}</a> }))

const mockNote = {
  id: 'n1', notepad_id: 'pad-1', user_id: 'u1',
  content: 'This is a test note', source: 'typed' as const,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}

const mockPad = {
  id: 'pad-1', user_id: 'u1', name: 'Business Ideas',
  icon: '💡', color: '#f5a623', sort_order: 0, is_active: true,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}

describe('NoteEntry', () => {
  it('renders note content', async () => {
    const { NoteEntry } = await import('@/components/notes/NoteEntry')
    render(<NoteEntry note={mockNote} />)
    expect(screen.getByText('This is a test note')).toBeInTheDocument()
  })

  it('shows Typed source badge', async () => {
    const { NoteEntry } = await import('@/components/notes/NoteEntry')
    render(<NoteEntry note={mockNote} />)
    expect(screen.getByText('Typed')).toBeInTheDocument()
  })
})

describe('PadCard', () => {
  it('renders pad name', async () => {
    const { PadCard } = await import('@/components/notes/PadCard')
    render(<PadCard pad={mockPad} entryCount={5} preview="Sample text" />)
    expect(screen.getByText('Business Ideas')).toBeInTheDocument()
  })

  it('shows entry count', async () => {
    const { PadCard } = await import('@/components/notes/PadCard')
    render(<PadCard pad={mockPad} entryCount={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
