import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Shared mock so every createClient() call returns the same object
const mockSignInWithOAuth = jest.fn().mockResolvedValue({ data: {}, error: null })
const mockSupabaseClient = {
  auth: {
    signInWithOAuth: mockSignInWithOAuth,
  },
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/login',
}))

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Re-apply the return value since clearAllMocks resets mock implementations
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null })
  })

  it('renders the APEX wordmark', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    // The wordmark is split across <span>A</span>PEX — match by full text content
    expect(screen.getByText((_, el) => el?.textContent === 'APEX')).toBeInTheDocument()
  })

  it('renders the tagline', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    expect(screen.getByText(/pathway to the peak/i)).toBeInTheDocument()
  })

  it('renders a Continue with Google button', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
  })

  it('calls signInWithOAuth with google provider on button click', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    const btn = screen.getByRole('button', { name: /continue with google/i })
    await userEvent.click(btn)
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    )
  })
})
