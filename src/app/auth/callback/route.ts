import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const meta = user.user_metadata ?? {}
    const displayName: string =
      meta.full_name ?? meta.name ?? meta.email?.split('@')[0] ?? ''
    const email: string = meta.email ?? user.email ?? ''

    // Upsert base user row (ignoreDuplicates so we don't overwrite existing data)
    await supabase.from('users').upsert(
      {
        id: user.id,
        email,
        display_name: displayName,
        canvas_domain: 'canvas.cmu.edu',
        session_mode: '90_20',
        planning_notif_time: '08:00',
        timezone: 'America/New_York',
        onboarding_complete: false,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )

    // Persist Google Calendar OAuth tokens if present (from calendar scope flow)
    const { data: sessionData } = await supabase.auth.getSession()
    const providerToken = sessionData.session?.provider_token
    const providerRefresh = sessionData.session?.provider_refresh_token
    if (providerToken) {
      await supabase.from('users').update({
        google_calendar_token: providerToken,
        ...(providerRefresh ? { google_calendar_refresh_token: providerRefresh } : {}),
      }).eq('id', user.id)
    }

    const { data: profile } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()

    if (profile?.onboarding_complete) {
      const response = NextResponse.redirect(`${origin}/home`)
      response.cookies.set('apex_onboarded', 'true', {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      })
      return response
    }
  }

  return NextResponse.redirect(`${origin}/onboarding`)
}
