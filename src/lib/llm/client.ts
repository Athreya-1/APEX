import { routeModel, type ModelJob } from './models'

export interface ModelCallArgs {
  job: ModelJob
  system: string
  user: string
  maxTokens?: number
}

export type ModelCaller = (args: ModelCallArgs) => Promise<string>

/**
 * Real Anthropic-backed caller. Network-bound; routes the model by job.
 * Throws a clear error at call time if no API key is configured.
 */
export function createAnthropicCaller(apiKey = process.env.ANTHROPIC_API_KEY): ModelCaller {
  return async ({ job, system, user, maxTokens = 1024 }) => {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })
    const res = await client.messages.create({
      model: routeModel(job),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })
    return res.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
  }
}
