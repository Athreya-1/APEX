import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_id, field_def_id, value } = await request.json()
  if (!task_id || !field_def_id) {
    return Response.json({ error: 'task_id and field_def_id required' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('task_field_values')
    .select('id')
    .eq('task_id', task_id)
    .eq('field_def_id', field_def_id)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('task_field_values')
      .update({ value })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ value: data })
  }

  const { data, error } = await supabase.from('task_field_values').insert({
    user_id: user.id,
    task_id,
    field_def_id,
    value,
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ value: data })
}
