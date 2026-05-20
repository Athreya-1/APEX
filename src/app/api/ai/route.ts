import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { INTENT_CLASSIFICATION_PROMPT } from '@/lib/ai/prompts'
import { handleIntent } from '@/lib/ai/router'

interface AIRequestBody {
  input: string
  context?: {
    user_name?: string
    courses?: string[]
    notepads?: string[]
    habits?: string[]
    recent_tasks?: string[]
  }
  image?: string
  confirmed?: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body: AIRequestBody = await request.json()
  const { input, context = {}, image } = body

  const now = new Date()
  const contextStr = INTENT_CLASSIFICATION_PROMPT
    .replace('{user_name}', context.user_name ?? 'User')
    .replace('{current_datetime}', now.toISOString())
    .replace('{courses}', JSON.stringify(context.courses ?? []))
    .replace('{notepads}', JSON.stringify(context.notepads ?? []))
    .replace('{habits}', JSON.stringify(context.habits ?? []))
    .replace('{recent_tasks}', JSON.stringify(context.recent_tasks ?? []))

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: contextStr,
    messages: [{ role: 'user', content: input }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  let intent = 'ambiguous'
  let parsed: Record<string, unknown> = {}

  try {
    const json = JSON.parse(text)
    intent = json.intent ?? 'ambiguous'
    parsed = json.parsed ?? {}

    if (intent === 'ambiguous' && json.clarification_needed) {
      return Response.json({ action: 'clarify', question: json.clarification_needed })
    }
  } catch {
    return Response.json({ action: 'error', result: 'Failed to parse AI response' })
  }

  const result = await handleIntent(intent, parsed, user.id, supabase, image)
  return Response.json(result)
}
