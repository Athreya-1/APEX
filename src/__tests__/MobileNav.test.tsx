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

describe('MobileNav', () => {
  it('renders exactly 5 nav items', async () => {
    const { MobileNav } = await import('@/components/layout/MobileNav')
    render(<MobileNav />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
  })

  it('renders the 5 V1 tab labels', async () => {
    const { MobileNav } = await import('@/components/layout/MobileNav')
    render(<MobileNav />)
    ;['Home', 'Plan', 'Tasks', 'Habits', 'Settings'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('hides features deferred from V1', async () => {
    const { MobileNav } = await import('@/components/layout/MobileNav')
    render(<MobileNav />)
    ;['Notes', 'Review'].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    })
  })

  it('applies amber color to active /home link', async () => {
    const { usePathname } = require('next/navigation')
    ;(usePathname as jest.Mock).mockReturnValue('/home')
    const { MobileNav } = await import('@/components/layout/MobileNav')
    render(<MobileNav />)
    const homeLink = screen.getByText('Home').closest('a')!
    expect(homeLink).toHaveStyle({ color: 'var(--amber)' })
  })

  it('applies muted color to inactive links', async () => {
    const { usePathname } = require('next/navigation')
    ;(usePathname as jest.Mock).mockReturnValue('/home')
    const { MobileNav } = await import('@/components/layout/MobileNav')
    render(<MobileNav />)
    const planLink = screen.getByText('Plan').closest('a')!
    expect(planLink).toHaveStyle({ color: 'var(--text2)' })
  })
})
