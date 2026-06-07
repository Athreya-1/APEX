import { MobileNav } from './MobileNav'
import { DesktopSidebar } from './DesktopSidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="apex-ambient" aria-hidden />
      <div className="apex-app">
        <DesktopSidebar />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
      <MobileNav />
    </>
  )
}
