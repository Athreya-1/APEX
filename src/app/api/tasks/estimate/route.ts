import { createClient } from '@/lib/supabase/server'
import { estimateTaskEffort } from '@/lib/tasks/estimate-task'
import { applyTriangulation, type TriangulationChoice } from '@/lib/tasks/triangulation'
import type { TaskTypeTag } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_type_tag, course_id, triangulation } = await request.json() as {
    task_type_tag: TaskTypeTag
    course_id?: string | null
    triangulation?: TriangulationChoice
  }

  if (!task_type_tag) {
    return Response.json({ error: 'task_type_tag required' }, { status: 400 })
  }

  const mult = triangulation ? { shorter: 0.6, typical: 1.0, longer: 1.5 }[triangulation] : 1
  const estimate = await estimateTaskEffort(supabase, user.id, task_type_tag, course_id ?? null, mult)

  const estimated_hours = triangulation
    ? applyTriangulation(estimate.estimatedHours, triangulation)
    : estimate.estimatedHours

  return Response.json({
    estimated_hours,
    padded_hours: estimate.paddedHours,
    confidence: estimate.confidence,
    source: estimate.source,
    needs_first_estimate: estimate.needsFirstEstimate,
  })
}
