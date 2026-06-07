import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ goals: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { name, description, deadline, color } = body
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })
  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: user.id, name: name.trim(), description: description ?? null, deadline: deadline ?? null, color: color ?? 'var(--amber)', status: 'active' })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ goal: data })
}
