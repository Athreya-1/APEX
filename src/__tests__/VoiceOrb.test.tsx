import { render, screen, fireEvent } from '@testing-library/react'
import { VoiceOrb } from '@/components/input/VoiceOrb'

// Mock useVoice
jest.mock('@/hooks/useVoice', () => ({
  useVoice: () => ({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    startListening: jest.fn(),
    stopListening: jest.fn(),
    isSupported: true,
  }),
}))

describe('VoiceOrb', () => {
  it('renders full mode with confirm button', () => {
    render(<VoiceOrb mode="full" onSubmit={jest.fn()} onClose={jest.fn()} />)
    expect(screen.getByText('Confirm ↑')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('renders mini mode as orb button', () => {
    const { container } = render(<VoiceOrb mode="mini" onSubmit={jest.fn()} />)
    // Should render a clickable div
    const orb = container.firstChild
    expect(orb).toBeTruthy()
  })

  it('calls onClose when Cancel clicked in full mode', () => {
    const onClose = jest.fn()
    render(<VoiceOrb mode="full" onSubmit={jest.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
