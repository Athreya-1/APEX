// src/app/api/canvas/sync/route.ts
import { createClient } from '@/lib/supabase/server'
import {
  fetchCanvasCourses,
  fetchCanvasAssignments,
  matchCourse,
  classifyTaskType,
  type SyncResult,
} from '@/lib/canvas/sync'
import type { TaskTypeTag } from '@/types'

export async function POST(_request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Get user's Canvas credentials
  const { data: userData } = await supabase
    .from('users')
    .select('canvas_api_token, canvas_domain')
    .eq('id', user.id)
    .single()

  if (!userData?.canvas_api_token) {
    return Response.json({ error: 'No Canvas API token configured' }, { status: 400 })
  }

  const { data: userCourses } = await supabase
    .from('courses')
    .select('id, name, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (!userCourses?.length) {
    return Response.json({ error: 'No active courses found' }, { status: 400 })
  }

  const result: SyncResult = {
    assignments_found: 0,
    assignments_new: 0,
    assignments_updated: 0,
    courses_synced: [],
    errors: [],
  }

  try {
    const canvasCourses = await fetchCanvasCourses(
      userData.canvas_api_token,
      userData.canvas_domain ?? 'canvas.cmu.edu',
    )

    for (const canvasCourse of canvasCourses) {
      try {
        const assignments = await fetchCanvasAssignments(
          userData.canvas_api_token,
          userData.canvas_domain ?? 'canvas.cmu.edu',
          canvasCourse.id,
          canvasCourse.name,
        )

        result.assignments_found += assignments.length
        result.courses_synced.push(canvasCourse.name)

        for (const assignment of assignments) {
          if (!assignment.due_at) continue // Skip assignments without due dates

          const { course: matchedCourse, confidence } = matchCourse(
            canvasCourse.name,
            userCourses,
          )

          // Only auto-create if high confidence match
          if (confidence < 0.7 || !matchedCourse) continue

          // Check if task already exists (by canvas_assignment_id)
          const { data: existing } = await supabase
            .from('tasks')
            .select('id')
            .eq('user_id', user.id)
            .eq('canvas_assignment_id', String(assignment.id))
            .single()

          if (existing) {
            // Update due date if changed
            await supabase
              .from('tasks')
              .update({ due_date: assignment.due_at })
              .eq('id', existing.id)
            result.assignments_updated++
          } else {
            // Create new task
            const typeTag = classifyTaskType(assignment.name)
            await supabase.from('tasks').insert({
              user_id: user.id,
              course_id: matchedCourse.id,
              canvas_assignment_id: String(assignment.id),
              task_name: assignment.name,
              topic: matchedCourse.name,
              task_type_tag: typeTag as TaskTypeTag,
              due_date: assignment.due_at,
              description: assignment.description
                ? assignment.description.replace(/<[^>]*>/g, '').slice(0, 500)
                : null,
              status: 'pending',
              source: 'canvas',
              eisenhower_quadrant: 'not_urgent_important',
            })
            result.assignments_new++
          }
        }
      } catch (err) {
        result.errors.push({ course_id: canvasCourse.id, message: String(err) })
      }
    }
  } catch (err) {
    result.errors.push({ message: String(err) })
  }

  // Log the sync
  await supabase.from('canvas_sync_log').insert({
    user_id: user.id,
    assignments_found: result.assignments_found,
    assignments_new: result.assignments_new,
    assignments_updated: result.assignments_updated,
    courses_synced: result.courses_synced,
    errors: result.errors,
    triggered_by: 'manual',
  })

  return Response.json(result)
}
