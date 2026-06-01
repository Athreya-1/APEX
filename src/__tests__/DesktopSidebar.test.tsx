import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/home'),
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
    expect(screen.getByText('APEX')).toBeInTheDocument()
  })

  it('renders only V1 navigation labels', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    const expectedLabels = ['Home', 'Daily Plan', 'Task Manager', 'Habit Tracker', 'Settings']
    expectedLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('hides features deferred from V1', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    ;['Notepads', 'Exam Plans', 'Knowledge Bank'].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    })
  })

  it('applies amber color to active link', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    const homeLink = screen.getByText('Home').closest('a')!
    expect(homeLink).toHaveStyle({ color: 'var(--amber)' })
  })

  it('applies muted color to inactive links', async () => {
    const { DesktopSidebar } = await import('@/components/layout/DesktopSidebar')
    render(<DesktopSidebar />)
    const settingsLink = screen.getByText('Settings').closest('a')!
    expect(settingsLink).toHaveStyle({ color: 'var(--text2)' })
  })
})
