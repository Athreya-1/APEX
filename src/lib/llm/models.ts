export type ModelJob =
  | 'parse_quick_add'
  | 'parse_replan'
  | 'classify'
  | 'decompose_goal'
  | 'explain_plan'

export const MODELS = {
  HAIKU: process.env.APEX_MODEL_HAIKU ?? 'claude-haiku-4-5',
  SONNET: process.env.APEX_MODEL_SONNET ?? 'claude-sonnet-4-5',
} as const

const SONNET_JOBS: ReadonlySet<ModelJob> = new Set<ModelJob>(['decompose_goal', 'explain_plan'])

export function routeModel(job: ModelJob): string {
  return SONNET_JOBS.has(job) ? MODELS.SONNET : MODELS.HAIKU
}
