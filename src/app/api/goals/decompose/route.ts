import { createClient } from '@/lib/supabase/server'
import { createAnthropicCaller } from '@/lib/llm/client'
import { decomposeGoal } from '@/lib/llm/functions'
import type { GoalDecomposition } from '@/lib/llm/schemas'

function fallbackDecompose(goalText: string): GoalDecomposition {
  const title = goalText.trim()
  return {
    goalTitle: title,
    habits: [
      {
        title: `${title} — daily practice`,
        mode: 'time_blocked',
        durationMins: 30,
        frequencyType: 'daily',
        frequencyTarget: 1,
        cognitiveClass: 'heavy_focus',
        rationale: 'Consistent daily progress toward the goal',
      },
      {
        title: `Review progress on ${title}`,
        mode: 'check_off',
        durationMins: 15,
        frequencyType: 'weekly',
        frequencyTarget: 2,
        cognitiveClass: 'light_admin',
        rationale: 'Weekly reflection to stay on track',
      },
    ],
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { goalText?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const goalText = body.goalText?.trim()
  if (!goalText) return Response.json({ error: 'goalText required' }, { status: 400 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ decomposition: fallbackDecompose(goalText), source: 'fallback' })
  }

  try {
    const caller = createAnthropicCaller()
    const decomposition = await decomposeGoal(goalText, caller)
    return Response.json({ decomposition, source: 'ai' })
  } catch (err) {
    console.warn('[goals/decompose] LLM failed, using fallback:', (err as Error).message)
    return Response.json({ decomposition: fallbackDecompose(goalText), source: 'fallback' })
  }
}
