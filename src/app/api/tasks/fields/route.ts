import { createClient } from '@/lib/supabase/server'
import type { FieldKind } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('task_field_defs')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ fields: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, kind, options } = await request.json() as {
    name: string; kind: FieldKind; options?: string[]
  }
  if (!name?.trim() || !kind) {
    return Response.json({ error: 'name and kind required' }, { status: 400 })
  }

  const { count } = await supabase
    .from('task_field_defs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { data, error } = await supabase.from('task_field_defs').insert({
    user_id: user.id,
    name: name.trim(),
    kind,
    options: options ?? null,
    sort_order: count ?? 0,
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ field: data })
}
