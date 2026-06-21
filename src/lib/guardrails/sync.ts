import type { SupabaseClient } from '@supabase/supabase-js'
import type { Guardrail, GuardrailKind } from '@/types'

const NO_WORK_KINDS: GuardrailKind[] = ['no_work_before', 'no_work_after']

export function noWorkTimesFromGuardrails(guardrails: Guardrail[]): {
  no_work_before: string | null
  no_work_after: string | null
} {
  let no_work_before: string | null = null
  let no_work_after: string | null = null
  for (const gr of guardrails) {
    if (!gr.is_active) continue
    const time = (gr.payload as { time?: string }).time
    if (!time) continue
    if (gr.kind === 'no_work_before') no_work_before = time
    if (gr.kind === 'no_work_after') no_work_after = time
  }
  return { no_work_before, no_work_after }
}

export async function syncNoWorkGuardrails(
  supabase: SupabaseClient,
  userId: string,
  noWorkBefore: string,
  noWorkAfter: string,
): Promise<void> {
  await Promise.all([
    upsertGuardrail(supabase, userId, 'no_work_before', noWorkBefore),
    upsertGuardrail(supabase, userId, 'no_work_after', noWorkAfter),
  ])
}

async function upsertGuardrail(
  supabase: SupabaseClient,
  userId: string,
  kind: GuardrailKind,
  time: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from('guardrails')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', kind)
    .order('created_at')

  if (rows?.length) {
    await supabase
      .from('guardrails')
      .update({ payload: { time }, is_active: true, hard: true })
      .eq('id', rows[0].id)
    for (const extra of rows.slice(1)) {
      await supabase.from('guardrails').update({ is_active: false }).eq('id', extra.id)
    }
    return
  }

  await supabase.from('guardrails').insert({
    user_id: userId,
    kind,
    payload: { time },
    hard: true,
    is_active: true,
  })
}

export function isNoWorkGuardrailKind(kind: string): kind is GuardrailKind {
  return NO_WORK_KINDS.includes(kind as GuardrailKind)
}
