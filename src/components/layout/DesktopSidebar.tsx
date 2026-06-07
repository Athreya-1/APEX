'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/home', label: 'Home', icon: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { href: '/plan', label: 'Planner', icon: 'RECT' },
  { href: '/tasks', label: 'To-Do', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
  { href: '/habits', label: 'Habits', icon: 'M12 21s-7-4.35-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.65-9 9-9 9z' },
] as const

function NavIcon({ path }: { path: string }) {
  if (path === 'RECT') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d={path} />
    </svg>
  )
}

export function DesktopSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    document.cookie = 'apex_onboarded=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <aside className="apex-rail hidden md:flex">
      <Link href="/home" className="apex-brand">
        <span className="a">A</span>PEX
      </Link>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`apex-nav-item${active ? ' active' : ''}`}
            >
              <NavIcon path={item.icon} />
              <span>{item.label}</span>
            </Link>
          )
        })}
        <div style={{ flex: 1 }} />
        <Link
          href="/settings"
          className={`apex-nav-item${pathname.startsWith('/settings') ? ' active' : ''}`}
          title="Settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1l-.3-2.5H9.4l-.3 2.5a7 7 0 00-1.7 1l-2.3-1-2 3.4L5 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.3 2.5h4.2l.3-2.5a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1z" />
          </svg>
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          title="Log out"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 10,
            border: 'none',
            background: 'none',
            color: 'var(--text3)',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            marginTop: 2,
            transition: 'background .15s, color .15s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Log out</span>
        </button>
      </nav>
    </aside>
  )
}
