import { createClient } from '@/lib/supabase/server'
import { getEventsForDate, createGCalEvent, updateGCalEvent, deleteGCalEvent } from '@/lib/calendar/gcal'
import { diffGCalBlocks, applyGCalSync } from '@/lib/calendar/gcal-sync'
import { generatePlan } from '@/lib/planning/engine'
import { buildPlanRequest, type TaskPadded } from '@/lib/planning/orchestrator'
import { engineBlocksToInserts } from '@/lib/planning/persist'
import { computePaddedEffort } from '@/lib/planning/estimation'
import type { Course, Task } from '@/types'

interface GenerateRequestBody {
  plan_date: string
  sleep_time: string
  session_mode?: '90_20' | '50_10'
  constraints?: Record<string, unknown>
}

function taskToPadded(task: Task, course: Course | undefined): TaskPadded {
  const priorMins = (task.estimated_hours ?? task.ai_estimated_hours ?? 2) * 60
  const effort = computePaddedEffort({
    priorMinutes: priorMins,
    courseDifficulty: course?.difficulty_multiplier ?? 1,
    courseVelocity: course?.velocity_modifier ?? 1,
    triangulation: task.triangulation_multiplier ?? 1,
    bucket: null,
    type: null,
  })
  return {
    task,
    paddedHours: effort.paddedHours,
    meanHours: effort.estimateHours,
    stdevHours: effort.stdevHours,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body: GenerateRequestBody = await request.json()
  const { plan_date, sleep_time, session_mode = '90_20' } = body
  const now = new Date().toISOString()

  const [
    { data: userData },
    { data: tasks },
    { data: courses },
    { data: prefs },
    { data: guardrails },
    { data: habits },
    { data: habitLogs },
  ] = await Promise.all([
    supabase.from('users').select('google_calendar_token,google_calendar_refresh_token,display_name').eq('id', user.id).single(),
    supabase.from('tasks').select('*').eq('user_id', user.id).in('status', ['pending', 'in_progress']),
    supabase.from('courses').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
    supabase.from('guardrails').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('habits').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('habit_logs').select('*').eq('user_id', user.id),
  ])

  if (!prefs) {
    return Response.json({ error: 'User preferences not found' }, { status: 400 })
  }

  const tokenRefresh = async (newToken: string, newRefresh: string | null) => {
    await supabase.from('users').update({
      google_calendar_token: newToken,
      ...(newRefresh ? { google_calendar_refresh_token: newRefresh } : {}),
    }).eq('id', user.id)
  }

  const courseById = new Map((courses ?? []).map((c: Course) => [c.id, c]))
  const paddedTasks = (tasks ?? []).map((t: Task) => taskToPadded(t, t.course_id ? courseById.get(t.course_id) : undefined))

  const prefWake = prefs.wake_time_default ?? '07:30'
  const [wh, wm] = prefWake.split(':').map(Number)
  const planDay = new Date(plan_date + 'T00:00:00')
  const wakeDate = new Date(planDay)
  wakeDate.setHours(wh, wm, 0, 0)
  const windowStart = wakeDate.toISOString()
  const windowEnd = sleep_time

  const { data: courseSessions } = await supabase
    .from('course_sessions')
    .select('*')
    .in('course_id', (courses ?? []).map((c: Course) => c.id))

  let gcalEvents: Awaited<ReturnType<typeof getEventsForDate>> = []
  if (userData?.google_calendar_token) {
    try {
      gcalEvents = await getEventsForDate(
        userData.google_calendar_token,
        userData.google_calendar_refresh_token ?? null,
        plan_date,
        tokenRefresh,
      )
    } catch { /* continue without GCal */ }
  }

  const planRequest = buildPlanRequest({
    planDate: plan_date,
    windowStart,
    windowEnd,
    now,
    sessionMode: session_mode,
    prefs,
    tasks: paddedTasks,
    habits: habits ?? [],
    habitLogs: habitLogs ?? [],
    guardrails: guardrails ?? [],
    gcalEvents,
    courseSessions: courseSessions ?? [],
  })

  const result = generatePlan(planRequest)
  const inserts = engineBlocksToInserts(result.blocks)

  const { data: existingPlan } = await supabase
    .from('daily_plans')
    .select('id')
    .eq('user_id', user.id)
    .eq('plan_date', plan_date)
    .single()

  let planId: string
  if (existingPlan) {
    planId = existingPlan.id
    await supabase.from('plan_blocks').delete().eq('plan_id', planId)
    await supabase.from('daily_plans').update({
      sleep_time,
      wake_time: windowStart,
      session_mode,
      status: 'confirmed',
      work_life_dial_used: result.dialUsed,
      work_hour_cap_breached: result.capBreached,
      generated_by: 'user',
    }).eq('id', planId)
  } else {
    const { data: newPlan, error } = await supabase.from('daily_plans').insert({
      user_id: user.id,
      plan_date,
      sleep_time,
      wake_time: windowStart,
      session_mode,
      status: 'confirmed',
      work_life_dial_used: result.dialUsed,
      work_hour_cap_breached: result.capBreached,
      generated_by: 'user',
    }).select().single()
    if (error || !newPlan) return Response.json({ error: 'Failed to create plan' }, { status: 500 })
    planId = newPlan.id
  }

  const insertedBlocks: Array<{ id: string; task_id: string | null; block_type: string; start_time: string; end_time: string; label: string | null; gcal_event_id: string | null }> = []

  for (const row of inserts) {
    const { data: block, error } = await supabase.from('plan_blocks').insert({
      plan_id: planId,
      user_id: user.id,
      ...row,
    }).select().single()
    if (block && !error) insertedBlocks.push(block)
  }

  // Cache urgency scores on tasks
  for (const t of planRequest.tasks) {
    await supabase.from('tasks').update({
      urgency_score: t.urgencyScore,
      is_at_risk: t.isAtRisk,
      importance: t.importance,
    }).eq('id', t.id)
  }

  // GCal diff-sync
  if (userData?.google_calendar_token) {
    const syncBlocks = insertedBlocks.map((b) => ({
      id: b.id,
      label: b.label,
      start_time: b.start_time,
      end_time: b.end_time,
      block_type: b.block_type,
      gcal_event_id: b.gcal_event_id,
    }))
    const diff = diffGCalBlocks(syncBlocks, gcalEvents)
    const token = userData.google_calendar_token
    const refresh = userData.google_calendar_refresh_token ?? null
    const created = await applyGCalSync(diff, {
      create: (block) => createGCalEvent(token, refresh, {
        id: block.id,
        label: block.label,
        description: block.description ?? null,
        start_time: block.start_time,
        end_time: block.end_time,
        block_type: block.block_type,
      }, tokenRefresh),
      update: (gcalId, block) => updateGCalEvent(token, refresh, gcalId, block, tokenRefresh),
      remove: (gcalId) => deleteGCalEvent(token, refresh, gcalId, tokenRefresh),
    })
    for (const [blockId, gcalId] of Object.entries(created)) {
      await supabase.from('plan_blocks').update({ gcal_event_id: gcalId }).eq('id', blockId)
    }
  }

  return Response.json({
    plan_id: planId,
    blocks: insertedBlocks,
    warnings: result.warnings,
    reasoning: result.reasoning,
    cap_breached: result.capBreached,
    count: insertedBlocks.length,
  })
}
