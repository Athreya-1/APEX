/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server'

// Mock @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

function makeRequest(pathname: string) {
  return new NextRequest(new URL(`http://localhost${pathname}`))
}

function mockSupabaseUser(user: object | null) {
  const { createServerClient } = require('@supabase/ssr')
  ;(createServerClient as jest.Mock).mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  })
}

describe('middleware', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockSupabaseUser(null)
  })

  it('redirects unauthenticated user from /home to /login', async () => {
    const { proxy } = await import('../proxy')
    const req = makeRequest('/home')
    const res = await proxy(req)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects authenticated user from /login to /home', async () => {
    mockSupabaseUser({ id: 'user-123' })
    const { proxy } = await import('../proxy')
    const req = makeRequest('/login')
    const res = await proxy(req)
    expect(res.headers.get('location')).toContain('/home')
  })

  it('allows authenticated user to access /home', async () => {
    mockSupabaseUser({ id: 'user-123' })
    const { proxy } = await import('../proxy')
    const req = makeRequest('/home')
    const res = await proxy(req)
    expect(res.status).not.toBe(307)
    expect(res.status).not.toBe(302)
  })

  it('allows unauthenticated user to access /login', async () => {
    const { proxy } = await import('../proxy')
    const req = makeRequest('/login')
    const res = await proxy(req)
    expect(res.headers.get('location')).toBeNull()
  })

  it('allows /auth/callback regardless of auth state', async () => {
    const { proxy } = await import('../proxy')
    const req = makeRequest('/auth/callback')
    const res = await proxy(req)
    expect(res.headers.get('location')).toBeNull()
  })
})
