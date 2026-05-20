import { createClient } from '@/lib/supabase/server'
import { getEventsForDate } from '@/lib/calendar/gcal'
import { format } from 'date-fns'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date') ?? format(new Date(), 'yyyy-MM-dd')

  const { data: userData } = await supabase
    .from('users')
    .select('google_calendar_token, google_calendar_refresh_token')
    .eq('id', user.id)
    .single()

  if (!userData?.google_calendar_token) {
    return Response.json({ events: [], message: 'Google Calendar not connected' })
  }

  try {
    const events = await getEventsForDate(
      userData.google_calendar_token,
      userData.google_calendar_refresh_token ?? null,
      date,
    )
    return Response.json({ events, date })
  } catch (err) {
    return Response.json({ error: 'Failed to fetch GCal events', details: String(err) }, { status: 500 })
  }
}
