import { createClient } from '@/lib/supabase/server'
import { createGCalEvent, updateGCalEvent, deleteGCalEvent, getEventsForDate } from '@/lib/calendar/gcal'
import { diffGCalBlocks, applyGCalSync } from '@/lib/calendar/gcal-sync'
import { generatePlan } from '@/lib/planning/engine'
import { buildPlanRequest, shiftBlocksFromTime, type TaskPadded } from '@/lib/planning/orchestrator'
import { engineBlocksToInserts } from '@/lib/planning/persist'
import { computePaddedEffort } from '@/lib/planning/estimation'
import { parseReplan } from '@/lib/llm/functions'
import { createAnthropicCaller } from '@/lib/llm/client'
import type { Course, PlanBlock, Task } from '@/types'

interface ReplanBody {
  plan_date: string
  block_id?: string
  extra_mins?: number
  from_time?: string
  instruction?: string
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
  return { task, paddedHours: effort.paddedHours, meanHours: effort.estimateHours, stdevHours: effort.stdevHours }
}

async function syncBlocksToGCal(
  blocks: PlanBlock[],
  gcalEvents: Awaited<ReturnType<typeof getEventsForDate>>,
  token: string,
  refresh: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
  onTokenRefresh?: (newToken: string, newRefresh: string | null) => Promise<void>,
) {
  const diff = diffGCalBlocks(
    blocks.map((b) => ({
      id: b.id, label: b.label, start_time: b.start_time, end_time: b.end_time,
      block_type: b.block_type, gcal_event_id: b.gcal_event_id,
    })),
    gcalEvents,
  )
  const created = await applyGCalSync(diff, {
    create: (block) => createGCalEvent(token, refresh, {
      id: block.id,
      label: block.label,
      description: block.description ?? null,
      start_time: block.start_time,
      end_time: block.end_time,
      block_type: block.block_type,
    }, onTokenRefresh),
    update: (gcalId, block) => updateGCalEvent(token, refresh, gcalId, block, onTokenRefresh),
    remove: (gcalId) => deleteGCalEvent(token, refresh, gcalId, onTokenRefresh),
  })
  for (const [blockId, gcalId] of Object.entries(created)) {
    await supabase.from('plan_blocks').update({ gcal_event_id: gcalId }).eq('id', blockId)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  // Normal session-cookie auth
  let { data: { user } } = await supabase.auth.getUser()

  // Fallback: server-side AI router calls this with x-user-id + x-service-key
  // (no session cookie available in that context)
  if (!user) {
    const serviceKey = request.headers.get('x-service-key')
    const xUserId = request.headers.get('x-user-id')
    if (serviceKey && xUserId && serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Trust the user-id provided by our own server-side router
      user = { id: xUserId } as NonNullable<typeof user>
    }
  }

  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const tokenRefresh = async (newToken: string, newRefresh: string | null) => {
    await supabase.from('users').update({
      google_calendar_token: newToken,
      ...(newRefresh ? { google_calendar_refresh_token: newRefresh } : {}),
    }).eq('id', user!.id)
  }

  const body: ReplanBody = await request.json()
  const { plan_date, block_id, extra_mins, from_time, instruction } = body

  const { data: plan } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan_date', plan_date)
    .single()

  if (!plan) return Response.json({ error: 'No plan found for this date' }, { status: 404 })

  const { data: userData } = await supabase
    .from('users')
    .select('google_calendar_token,google_calendar_refresh_token')
    .eq('id', user.id)
    .single()

  // ── Micro-replan: extend one block and ripple subsequent blocks ──
  if (block_id && extra_mins) {
    const { data: block } = await supabase.from('plan_blocks').select('*').eq('id', block_id).single()
    if (!block) return Response.json({ error: 'Block not found' }, { status: 404 })

    const newEnd = new Date(Date.parse(block.end_time) + extra_mins * 60_000).toISOString()
    await supabase.from('plan_blocks').update({ end_time: newEnd }).eq('id', block_id)

    const { data: laterBlocks } = await supabase
      .from('plan_blocks')
      .select('*')
      .eq('plan_id', plan.id)
      .gt('start_time', block.end_time)
      .order('start_time')

    const shifted = shiftBlocksFromTime(laterBlocks ?? [], block.end_time, extra_mins)
    for (const lb of shifted) {
      if (lb.id === block_id) continue
      await supabase.from('plan_blocks').update({
        start_time: lb.start_time,
        end_time: lb.end_time,
      }).eq('id', lb.id)
    }

    const { data: allBlocks } = await supabase
      .from('plan_blocks')
      .select('*')
      .eq('plan_id', plan.id)
      .order('sort_order')

    if (userData?.google_calendar_token && allBlocks) {
      const gcalEvents = await getEventsForDate(
        userData.google_calendar_token,
        userData.google_calendar_refresh_token ?? null,
        plan_date,
        tokenRefresh,
      )
      await syncBlocksToGCal(
        allBlocks as PlanBlock[],
        gcalEvents,
        userData.google_calendar_token,
        userData.google_calendar_refresh_token ?? null,
        supabase,
        tokenRefresh,
      )
    }

    return Response.json({ blocks: allBlocks, mode: 'micro' })
  }

  // ── Full / NL replan: re-run deterministic engine from `from_time` ──
  const regenFrom = from_time ?? new Date().toISOString()
  let parsedInstruction: Awaited<ReturnType<typeof parseReplan>> | null = null
  if (instruction) {
    try {
      const caller = createAnthropicCaller()
      parsedInstruction = await parseReplan(instruction, caller)
    } catch {
      parsedInstruction = { intent: 'unknown', targetRef: null, params: {}, rawText: instruction }
    }
  }

  const [
    { data: tasks },
    { data: courses },
    { data: prefs },
    { data: guardrails },
    { data: habits },
    { data: habitLogs },
  ] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', user.id).in('status', ['pending', 'in_progress']),
    supabase.from('courses').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
    supabase.from('guardrails').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('habits').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('habit_logs').select('*').eq('user_id', user.id),
  ])

  if (!prefs) return Response.json({ error: 'User preferences not found' }, { status: 400 })

  const courseById = new Map((courses ?? []).map((c: Course) => [c.id, c]))
  const paddedTasks = (tasks ?? []).map((t: Task) => taskToPadded(t, t.course_id ? courseById.get(t.course_id) : undefined))

  const windowStart = regenFrom
  const windowEnd = plan.sleep_time ?? new Date(Date.parse(regenFrom) + 12 * 3_600_000).toISOString()

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
    } catch { /* ok */ }
  }

  const planRequest = buildPlanRequest({
    planDate: plan_date,
    windowStart,
    windowEnd,
    now: regenFrom,
    sessionMode: (plan.session_mode as '90_20' | '50_10') ?? '90_20',
    prefs,
    tasks: paddedTasks,
    habits: habits ?? [],
    habitLogs: habitLogs ?? [],
    guardrails: guardrails ?? [],
    gcalEvents,
    courseSessions: courseSessions ?? [],
  })

  const result = generatePlan(planRequest)

  // Keep blocks before regenFrom; replace the rest
  const { data: existingBlocks } = await supabase
    .from('plan_blocks')
    .select('*')
    .eq('plan_id', plan.id)
    .order('sort_order')

  const keep = (existingBlocks ?? []).filter((b) => Date.parse(b.end_time) <= Date.parse(regenFrom))
  const remove = (existingBlocks ?? []).filter((b) => Date.parse(b.start_time) >= Date.parse(regenFrom))
  for (const b of remove) {
    if (b.gcal_event_id && userData?.google_calendar_token) {
      await deleteGCalEvent(
        userData.google_calendar_token,
        userData.google_calendar_refresh_token ?? null,
        b.gcal_event_id,
        tokenRefresh,
      )
    }
    await supabase.from('plan_blocks').delete().eq('id', b.id)
  }

  const newInserts = engineBlocksToInserts(
    result.blocks.filter((b) => Date.parse(b.start) >= Date.parse(regenFrom)),
  )

  let sortOrder = keep.length
  const inserted: PlanBlock[] = [...keep as PlanBlock[]]
  for (const row of newInserts) {
    const { data: block } = await supabase.from('plan_blocks').insert({
      plan_id: plan.id,
      user_id: user.id,
      ...row,
      sort_order: sortOrder++,
    }).select().single()
    if (block) inserted.push(block as PlanBlock)
  }

  await supabase.from('daily_plans').update({
    work_life_dial_used: result.dialUsed,
    work_hour_cap_breached: result.capBreached,
    status: 'confirmed',
  }).eq('id', plan.id)

  if (userData?.google_calendar_token) {
    await syncBlocksToGCal(
      inserted,
      gcalEvents,
      userData.google_calendar_token,
      userData.google_calendar_refresh_token ?? null,
      supabase,
      tokenRefresh,
    )
  }

  return Response.json({
    blocks: inserted,
    warnings: result.warnings,
    reasoning: result.reasoning,
    mode: 'full',
    instruction: parsedInstruction,
  })
}
