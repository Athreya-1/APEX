import { createClient } from '@/lib/supabase/server'
import { estimateHours } from '@/lib/planning/effort'
import type { TaskTypeTag } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_type_tag, course_id } = await request.json()

  if (!task_type_tag) {
    return Response.json({ error: 'task_type_tag required' }, { status: 400 })
  }

  const estimate = await estimateHours(task_type_tag as TaskTypeTag, course_id ?? null, user.id)
  return Response.json(estimate)
}
