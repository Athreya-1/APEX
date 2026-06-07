import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/home'),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams('')),
}))

jest.mock('next/link', () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

describe('DesktopSidebar', () => {
  it('renders APEX wordmark', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    expect(screen.getByText((_, el) => el?.textContent === 'APEX')).toBeInTheDocument()
  })

  it('renders mockup navigation labels', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    ;['Home', 'Planner', 'To-Do', 'Habits', 'Settings'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('hides features deferred from V1', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    ;['Notepads', 'Exam Plans', 'Knowledge Bank', 'Daily Plan', 'Task Manager'].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    })
  })

  it('marks active route with active class', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    const homeLink = screen.getByText('Home').closest('a')!
    expect(homeLink.className).toContain('active')
  })

  it('does not mark inactive routes as active', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    const settingsLink = screen.getByText('Settings').closest('a')!
    expect(settingsLink.className).not.toContain('active')
  })
})
