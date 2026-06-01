'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { href: string; label: string } | null

const SIDEBAR_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home' },
  { href: '/plan', label: 'Daily Plan' },
  { href: '/tasks', label: 'Task Manager' },
  { href: '/habits', label: 'Habit Tracker' },
  /* hidden in V1 (routes kept on disk, restorable):
  { href: '/notes', label: 'Notepads' },
  null,
  { href: '/exams', label: 'Exam Plans' },
  { href: '/knowledge', label: 'Knowledge Bank' },
  */
  null,
  { href: '/settings', label: 'Settings' },
]

export function DesktopSidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex flex-col w-56 min-h-screen shrink-0"
      style={{
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div className="px-5 py-6">
        <span
          className="text-xl font-head font-bold"
          style={{ color: 'var(--amber)' }}
        >
          APEX
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {SIDEBAR_ITEMS.map((item, i) => {
          if (!item) {
            return (
              <hr
                key={`divider-${i}`}
                className="my-2"
                style={{ borderColor: 'var(--border)' }}
              />
            )
          }
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-head transition-colors"
              style={{
                background: isActive ? 'var(--bg3)' : 'transparent',
                color: isActive ? 'var(--amber)' : 'var(--text2)',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
