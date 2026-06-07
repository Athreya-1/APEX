'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { dedupeCourses, isLegacySeedCourse, type CourseRow } from '@/lib/courses/normalize'

export function useCourses(userId: string | undefined) {
  const supabase = createClient()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const { data } = await supabase
      .from('courses')
      .select('id, name, code, color, difficulty_multiplier')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at')
    const rows = (data ?? []).filter((c) => !isLegacySeedCourse(c))
    setCourses(dedupeCourses(rows))
    setIsLoading(false)
  }, [userId, supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { courses, isLoading, refresh }
}
