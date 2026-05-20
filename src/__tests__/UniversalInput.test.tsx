import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('UniversalInput', () => {
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => jest.clearAllMocks())

  it('renders the text input', async () => {
    const { UniversalInput } = await import('@/components/input/UniversalInput')
    render(<UniversalInput placeholder="Add a task…" onSubmit={mockOnSubmit} />)
    expect(screen.getByPlaceholderText('Add a task…')).toBeInTheDocument()
  })

  it('renders mic and attach icon buttons', async () => {
    const { UniversalInput } = await import('@/components/input/UniversalInput')
    render(<UniversalInput placeholder="Ask APEX…" onSubmit={mockOnSubmit} />)
    expect(screen.getByLabelText('Voice input')).toBeInTheDocument()
    expect(screen.getByLabelText('Attach file')).toBeInTheDocument()
  })

  it('renders a send button', async () => {
    const { UniversalInput } = await import('@/components/input/UniversalInput')
    render(<UniversalInput placeholder="Ask…" onSubmit={mockOnSubmit} />)
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('calls onSubmit with input text when send is clicked', async () => {
    const { UniversalInput } = await import('@/components/input/UniversalInput')
    render(<UniversalInput placeholder="Ask…" onSubmit={mockOnSubmit} />)
    await userEvent.type(screen.getByRole('textbox'), 'Lab 4 due Friday')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith('Lab 4 due Friday', undefined))
  })

  it('calls onSubmit on Enter key', async () => {
    const { UniversalInput } = await import('@/components/input/UniversalInput')
    render(<UniversalInput placeholder="Ask…" onSubmit={mockOnSubmit} />)
    await userEvent.type(screen.getByRole('textbox'), 'Add task{Enter}')
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith('Add task', undefined))
  })

  it('clears input after submit', async () => {
    const { UniversalInput } = await import('@/components/input/UniversalInput')
    render(<UniversalInput placeholder="Ask…" onSubmit={mockOnSubmit} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'test{Enter}')
    await waitFor(() => expect(input).toHaveValue(''))
  })
})
