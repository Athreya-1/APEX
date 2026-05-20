import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { PLANNING_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getEventsForDate, createGCalEvent } from '@/lib/calendar/gcal'
import { estimateHours } from '@/lib/planning/effort'
import { sortTasksForScheduling } from '@/lib/planning/urgency'
import type { Task, TaskTypeTag, BlockType } from '@/types'

interface GenerateRequestBody {
  plan_date: string // YYYY-MM-DD
  sleep_time: string // ISO — when user plans to sleep tonight
  session_mode?: '90_20' | '50_10'
  constraints?: {
    gaps?: Array<{ from: string; to: string }>
    skip_gym?: boolean
    skip_cmr?: boolean
    skip_entrepreneur?: boolean
  }
}

interface PlanBlockInput {
  block_type: string
  start_time: string
  end_time: string
  label: string
  description?: string
  task_name?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body: GenerateRequestBody = await request.json()
  const { plan_date, sleep_time, session_mode = '90_20', constraints } = body

  // Fetch all data needed for planning
  const [
    { data: userData },
    { data: tasks },
    { data: courses },
    { data: prefs },
  ] = await Promise.all([
    supabase.from('users').select('google_calendar_token,google_calendar_refresh_token,display_name').eq('id', user.id).single(),
    supabase.from('tasks').select('*').eq('user_id', user.id).in('status', ['pending', 'in_progress']).order('urgency_score', { ascending: false }),
    supabase.from('courses').select('*').eq('user_id', user.id).eq('is_active', true),
    supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
  ])

  const { data: courseSessions } = await supabase
    .from('course_sessions')
    .select('*')
    .in('course_id', (courses ?? []).map((c: { id: string }) => c.id))

  // Fetch GCal events if user has connected
  let gcalEvents: Array<{ start: string; end: string; title: string }> = []
  if (userData?.google_calendar_token) {
    try {
      const events = await getEventsForDate(
        userData.google_calendar_token,
        userData.google_calendar_refresh_token,
        plan_date,
      )
      gcalEvents = events.map((e) => ({ start: e.start, end: e.end, title: e.title }))
    } catch {
      // GCal unavailable — continue without it
    }
  }

  // Estimate hours for tasks that don't have estimates
  const tasksWithEstimates = await Promise.all(
    (tasks ?? []).map(async (task: Task) => {
      if (task.estimated_hours) return task
      const estimate = await estimateHours(
        task.task_type_tag as TaskTypeTag,
        task.course_id ?? null,
        user.id,
      )
      return { ...task, estimated_hours: estimate.estimated_hours }
    }),
  )

  // Sort tasks for scheduling
  const sortedTasks = sortTasksForScheduling(tasksWithEstimates, plan_date)

  // Calculate wake time from prefs (sleep_time is tonight, wake is tomorrow)
  const sleepDate = new Date(sleep_time)
  const wakeDate = new Date(sleepDate.getTime() + ((prefs?.sleep_buffer_hours ?? 8.5) * 3600 * 1000))

  // Build context for Claude
  const planningContext = {
    user_name: userData?.display_name ?? 'User',
    plan_date,
    wake_time: wakeDate.toISOString(),
    sleep_time,
    session_mode,
    tasks: sortedTasks.slice(0, 20).map((t) => ({
      id: t.id,
      task_name: t.task_name,
      topic: t.topic,
      task_type_tag: t.task_type_tag,
      estimated_hours: t.estimated_hours,
      due_date: t.due_date,
      do_date: t.do_date,
      urgency_score: t.urgency_score,
      eisenhower_quadrant: t.eisenhower_quadrant,
    })),
    courses: (courses ?? []).map((c: { name: string; id: string }) => ({ name: c.name, id: c.id })),
    course_sessions: (courseSessions ?? []).slice(0, 20),
    gcal_events: gcalEvents,
    preferences: {
      gym_duration_cascade: prefs?.gym_duration_cascade ?? [90, 60, 30],
      lunch_window: { start: prefs?.lunch_window_start ?? '11:00', end: prefs?.lunch_window_end ?? '15:00', duration_mins: prefs?.lunch_duration_mins ?? 45 },
      dinner_window: { start: prefs?.dinner_window_start ?? '19:00', end: prefs?.dinner_window_end ?? '23:00', duration_mins: prefs?.dinner_duration_mins ?? 60 },
      entrepreneur_daily_hours: prefs?.entrepreneur_daily_hours ?? 3,
      cmr_daily_hours: prefs?.cmr_daily_hours ?? 3,
      shower_mins: prefs?.shower_mins ?? 30,
      skincare_mins: prefs?.skincare_mins ?? 30,
    },
    constraints: constraints ?? {},
  }

  // Call Claude Sonnet for intelligent planning
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let planBlocks: PlanBlockInput[] = []

  try {
    const systemPrompt = typeof PLANNING_SYSTEM_PROMPT === 'string'
      ? PLANNING_SYSTEM_PROMPT
      : 'Generate a detailed daily plan as a JSON array of blocks with block_type, start_time, end_time, label, description fields.'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(planningContext) }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      planBlocks = JSON.parse(jsonMatch[0])
    }
  } catch {
    // Fall back to basic schedule if Claude fails
    planBlocks = [
      { block_type: 'routine', start_time: wakeDate.toISOString(), end_time: new Date(wakeDate.getTime() + 40 * 60000).toISOString(), label: 'Morning routine' },
      { block_type: 'sleep', start_time: sleepDate.toISOString(), end_time: new Date(sleepDate.getTime() + 8 * 3600000).toISOString(), label: 'Sleep' },
    ]
  }

  // Create or update daily_plans row
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
      wake_time: wakeDate.toISOString(),
      session_mode,
      status: 'confirmed',
    }).eq('id', planId)
  } else {
    const { data: newPlan } = await supabase.from('daily_plans').insert({
      user_id: user.id,
      plan_date,
      sleep_time,
      wake_time: wakeDate.toISOString(),
      session_mode,
      status: 'confirmed',
    }).select().single()
    planId = newPlan!.id
  }

  // Insert plan blocks + optionally write to GCal
  const insertedBlocks = []
  for (let i = 0; i < planBlocks.length; i++) {
    const b = planBlocks[i]

    const matchingTask = b.task_name
      ? tasksWithEstimates.find((t) => t.task_name === b.task_name)
      : null

    const { data: block } = await supabase.from('plan_blocks').insert({
      plan_id: planId,
      task_id: matchingTask?.id ?? null,
      block_type: (b.block_type ?? 'custom') as BlockType,
      start_time: b.start_time,
      end_time: b.end_time,
      label: b.label,
      description: b.description ?? null,
      status: 'scheduled',
      sort_order: i,
    }).select().single()

    if (block) {
      insertedBlocks.push(block)

      if (userData?.google_calendar_token) {
        try {
          const gcalId = await createGCalEvent(
            userData.google_calendar_token,
            userData.google_calendar_refresh_token ?? null,
            { ...block, label: block.label ?? block.block_type },
          )
          if (gcalId) {
            await supabase.from('plan_blocks').update({ gcal_event_id: gcalId }).eq('id', block.id)
          }
        } catch {
          // GCal write failed — continue
        }
      }
    }
  }

  return Response.json({ plan_id: planId, blocks: insertedBlocks, count: insertedBlocks.length })
}
