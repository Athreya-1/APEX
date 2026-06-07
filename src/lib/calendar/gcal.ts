// src/lib/calendar/gcal.ts
import { google } from 'googleapis'

export interface GCalEvent {
  id: string
  title: string
  start: string // ISO
  end: string // ISO
  apex_block_id?: string
}

function getOAuthClient(
  accessToken: string,
  refreshToken?: string,
  onTokenRefresh?: (newToken: string, newRefresh: string | null) => Promise<void>,
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  )
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (onTokenRefresh) {
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token) {
        onTokenRefresh(tokens.access_token, tokens.refresh_token ?? null).catch(console.error)
      }
    })
  }
  return oauth2Client
}

/**
 * Read all events for a given date from Google Calendar.
 * Returns events as blocked time slots for the planner to avoid.
 */
export async function getEventsForDate(
  accessToken: string,
  refreshToken: string | null,
  date: string, // YYYY-MM-DD
  onTokenRefresh?: (newToken: string, newRefresh: string | null) => Promise<void>,
): Promise<GCalEvent[]> {
  try {
    const auth = getOAuthClient(accessToken, refreshToken ?? undefined, onTokenRefresh)
    const calendar = google.calendar({ version: 'v3', auth })

    const startOfDay = new Date(`${date}T00:00:00`)
    const endOfDay = new Date(`${date}T23:59:59`)

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    return (res.data.items ?? [])
      .filter((ev) => ev.start?.dateTime && ev.end?.dateTime)
      .map((ev) => ({
        id: ev.id ?? '',
        title: ev.summary ?? 'Event',
        start: ev.start!.dateTime!,
        end: ev.end!.dateTime!,
        apex_block_id: (ev.extendedProperties?.private as Record<string, string> | undefined)?.apex_block_id,
      }))
  } catch (error) {
    console.error('GCal read error:', error)
    return []
  }
}

/**
 * Create a GCal event for an APEX plan block.
 * Returns the created GCal event ID.
 */
export async function createGCalEvent(
  accessToken: string,
  refreshToken: string | null,
  block: {
    id: string
    label: string | null
    description?: string | null
    start_time: string
    end_time: string
    block_type: string
  },
  onTokenRefresh?: (newToken: string, newRefresh: string | null) => Promise<void>,
): Promise<string | null> {
  try {
    const auth = getOAuthClient(accessToken, refreshToken ?? undefined, onTokenRefresh)
    const calendar = google.calendar({ version: 'v3', auth })

    // Color mapping (GCal colorId 1-11)
    const colorMap: Record<string, string> = {
      deep_work: '5',     // yellow/amber
      entrepreneur: '5',
      class: '1',        // blue
      meal: '2',         // green
      cmr: '4',          // pink/flamingo
      gym: '3',          // sage
      break: '8',        // graphite
      routine: '8',
      sleep: '8',
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `[APEX] ${block.label ?? block.block_type}`,
        description: block.description ?? '',
        start: { dateTime: block.start_time },
        end: { dateTime: block.end_time },
        colorId: colorMap[block.block_type] ?? '8',
        extendedProperties: {
          private: { apex_block_id: block.id },
        },
      },
    })

    return res.data.id ?? null
  } catch (error) {
    console.error('GCal write error:', error)
    return null
  }
}

/**
 * Update an existing GCal event for a plan block.
 */
export async function updateGCalEvent(
  accessToken: string,
  refreshToken: string | null,
  gcalEventId: string,
  block: {
    label: string | null
    description?: string | null
    start_time: string
    end_time: string
    block_type: string
  },
  onTokenRefresh?: (newToken: string, newRefresh: string | null) => Promise<void>,
): Promise<void> {
  try {
    const auth = getOAuthClient(accessToken, refreshToken ?? undefined, onTokenRefresh)
    const calendar = google.calendar({ version: 'v3', auth })
    const colorMap: Record<string, string> = {
      deep_work: '5', entrepreneur: '5', class: '1', meal: '2', cmr: '4', gym: '3', break: '8', routine: '8', sleep: '8',
    }
    await calendar.events.patch({
      calendarId: 'primary',
      eventId: gcalEventId,
      requestBody: {
        summary: `[APEX] ${block.label ?? block.block_type}`,
        description: block.description ?? '',
        start: { dateTime: block.start_time },
        end: { dateTime: block.end_time },
        colorId: colorMap[block.block_type] ?? '8',
      },
    })
  } catch (error) {
    console.error('GCal update error:', error)
  }
}

/**
 * Delete a GCal event by its event ID.
 */
export async function deleteGCalEvent(
  accessToken: string,
  refreshToken: string | null,
  gcalEventId: string,
  onTokenRefresh?: (newToken: string, newRefresh: string | null) => Promise<void>,
): Promise<void> {
  try {
    const auth = getOAuthClient(accessToken, refreshToken ?? undefined, onTokenRefresh)
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.delete({ calendarId: 'primary', eventId: gcalEventId })
  } catch (error) {
    console.error('GCal delete error:', error)
  }
}
