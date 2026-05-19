import { MobileNav } from './MobileNav'
import { DesktopSidebar } from './DesktopSidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <DesktopSidebar />
      <main className="flex-1 pb-20 md:pb-0 min-h-screen overflow-y-auto">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
