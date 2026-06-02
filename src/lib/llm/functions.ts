import type { ModelCaller } from './client'
import { parseWith } from './json'
import { parseQuickAddLocal, type LocalParseOpts } from './quickAddLocal'
import {
  QuickAddResultSchema, GoalDecompositionSchema, PlanExplanationSchema, ReplanInstructionSchema,
  type QuickAddResult, type GoalDecomposition, type PlanExplanation, type ReplanInstruction,
} from './schemas'

export interface QuickAddContext {
  knownCourses?: string[]
  timezone?: string
}

const QUICK_ADD_SYSTEM = `You convert a student's shorthand task entry into structured JSON.
Output ONLY JSON matching one of:
{"kind":"task","title":string,"courseCode":string|null,"taskType":"lab"|"pset"|"reading"|"project"|"writeup"|"quiz"|"review"|"exam"|"other","dueDate":ISO8601|null,"doDate":ISO8601|null,"estimateHours":number|null,"confidence":0..1}
or {"kind":"clarify","question":string,"missingFields":string[],"partial":{...}} when essential info is missing.`

export async function parseQuickAdd(
  text: string, ctx: QuickAddContext, caller: ModelCaller, opts: LocalParseOpts,
): Promise<QuickAddResult> {
  const local = () => parseQuickAddLocal(text, { ...opts, knownCourses: opts.knownCourses ?? ctx.knownCourses })
  try {
    const raw = await caller({
      job: 'parse_quick_add',
      system: QUICK_ADD_SYSTEM,
      user: `Known courses: ${(ctx.knownCourses ?? []).join(', ') || 'none'}\nNow: ${opts.now}\nEntry: ${text}`,
    })
    return parseWith(QuickAddResultSchema, raw)
  } catch {
    return local()
  }
}

const DECOMPOSE_SYSTEM = `You are a behavior-design coach. Decompose a stated goal into 1-5 concrete, trackable habits.
Output ONLY JSON: {"goalTitle":string,"habits":[{"title":string,"mode":"time_blocked"|"check_off","durationMins":int,"frequencyType":"daily"|"weekly"|"custom","frequencyTarget":int,"cognitiveClass":"heavy_focus"|"light_admin"|"creative"|"physical"|"restorative","rationale":string}]}`

export async function decomposeGoal(goalText: string, caller: ModelCaller): Promise<GoalDecomposition> {
  const raw = await caller({ job: 'decompose_goal', system: DECOMPOSE_SYSTEM, user: goalText, maxTokens: 1500 })
  return parseWith(GoalDecompositionSchema, raw)
}

const EXPLAIN_SYSTEM = `You explain a generated daily plan to its owner in a calm, confident voice.
Output ONLY JSON: {"summary":string,"highlights":string[]}`

export async function explainPlan(planSummary: string, caller: ModelCaller): Promise<PlanExplanation> {
  try {
    const raw = await caller({ job: 'explain_plan', system: EXPLAIN_SYSTEM, user: planSummary })
    return parseWith(PlanExplanationSchema, raw)
  } catch {
    return { summary: planSummary, highlights: [] }
  }
}

const REPLAN_SYSTEM = `You convert a natural-language schedule change request into a structured instruction.
Output ONLY JSON: {"intent":"move"|"resize"|"add"|"remove"|"swap"|"rebalance"|"unknown","targetRef":string|null,"params":object,"rawText":string}`

export async function parseReplan(text: string, caller: ModelCaller): Promise<ReplanInstruction> {
  try {
    const raw = await caller({ job: 'parse_replan', system: REPLAN_SYSTEM, user: text })
    return parseWith(ReplanInstructionSchema, raw)
  } catch {
    return { intent: 'unknown', targetRef: null, params: {}, rawText: text }
  }
}
