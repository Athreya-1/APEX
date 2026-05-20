'use client'
import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Habit, HabitLog } from '@/types'

interface UseHabitsReturn {
  habits: Habit[]
  logs: HabitLog[]
  isLoading: boolean
  toggleHabit: (habitId: string, completed: boolean) => Promise<void>
  addHabit: (name: string, icon: string, color: string) => Promise<void>
}

export function useHabits(userId: string | undefined): UseHabitsReturn {
  const supabase = createClient()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!userId) return
    setIsLoading(true)

    Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order'),
      supabase.from('habit_logs').select('*').eq('user_id', userId).gte('logged_date', format(new Date(Date.now() - 13 * 86400000), 'yyyy-MM-dd')),
    ]).then(([{ data: habitData }, { data: logData }]) => {
      if (habitData) setHabits(habitData)
      if (logData) setLogs(logData)
      setIsLoading(false)
    })

    // Real-time subscription for logs
    const channel = supabase
      .channel('habit_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLogs((prev) => [...prev, payload.new as HabitLog])
        } else if (payload.eventType === 'UPDATE') {
          setLogs((prev) => prev.map((l) => l.id === payload.new.id ? payload.new as HabitLog : l))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const toggleHabit = useCallback(async (habitId: string, completed: boolean) => {
    if (!userId) return
    await supabase.from('habit_logs').upsert({
      user_id: userId,
      habit_id: habitId,
      logged_date: today,
      completed,
      source: 'manual',
    }, { onConflict: 'user_id,habit_id,logged_date' })
  }, [userId, today])

  const addHabit = useCallback(async (name: string, icon: string, color: string) => {
    if (!userId) return
    const { data } = await supabase.from('habits').insert({
      user_id: userId,
      name,
      icon,
      color,
      target_frequency: 'daily',
      is_active: true,
      sort_order: habits.length,
    }).select().single()
    if (data) setHabits((prev) => [...prev, data])
  }, [userId, habits.length])

  return { habits, logs, isLoading, toggleHabit, addHabit }
}
