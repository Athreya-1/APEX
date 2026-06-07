'use client'
import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Habit, HabitLog, Goal } from '@/types'
import type { GoalDecomposition } from '@/lib/llm/schemas'

export interface CreateHabitInput {
  name: string
  icon?: string
  color?: string
  goalId?: string | null
  mode?: 'time_blocked' | 'check_off'
  durationMins?: number | null
  frequencyType?: string
  frequencyTarget?: number
  cognitiveClass?: string
}

interface UseHabitsReturn {
  habits: Habit[]
  logs: HabitLog[]
  goals: Goal[]
  isLoading: boolean
  toggleHabit: (habitId: string, completed: boolean) => Promise<void>
  addHabit: (input: CreateHabitInput) => Promise<Habit | null>
  createGoalWithHabits: (decomposition: GoalDecomposition, goalColor: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useHabits(userId: string | undefined): UseHabitsReturn {
  const supabase = createClient()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const thirtyAgo = format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd')
    const [{ data: habitData }, { data: logData }, { data: goalData }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order'),
      supabase.from('habit_logs').select('*').eq('user_id', userId).gte('logged_date', thirtyAgo),
      supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').order('sort_order'),
    ])
    if (habitData) setHabits(habitData)
    if (logData) setLogs(logData)
    if (goalData) setGoals(goalData)
    setIsLoading(false)
  }, [userId, supabase])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('habit_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLogs((prev) => [...prev, payload.new as HabitLog])
        } else if (payload.eventType === 'UPDATE') {
          setLogs((prev) => prev.map((l) => (l.id === payload.new.id ? payload.new as HabitLog : l)))
        } else if (payload.eventType === 'DELETE') {
          setLogs((prev) => prev.filter((l) => l.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  const toggleHabit = useCallback(async (habitId: string, completed: boolean) => {
    if (!userId) return
    const today = format(new Date(), 'yyyy-MM-dd')
    if (completed) {
      const { data } = await supabase
        .from('habit_logs')
        .upsert(
          { habit_id: habitId, user_id: userId, logged_date: today, completed: true, source: 'manual' },
          { onConflict: 'habit_id,logged_date' },
        )
        .select()
        .single()
      if (data) setLogs((prev) => [...prev.filter((l) => !(l.habit_id === habitId && l.logged_date === today)), data as HabitLog])
    } else {
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('logged_date', today).eq('user_id', userId)
      setLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.logged_date === today)))
    }
  }, [userId, supabase])

  const addHabit = useCallback(async (input: CreateHabitInput): Promise<Habit | null> => {
    if (!userId) return null
    const row = {
      user_id: userId,
      name: input.name,
      icon: input.icon ?? '🎯',
      color: input.color ?? 'var(--amber)',
      goal_id: input.goalId ?? null,
      mode: input.mode ?? 'check_off',
      duration_mins: input.durationMins ?? null,
      frequency_type: input.frequencyType ?? 'daily',
      frequency_target: input.frequencyTarget ?? 1,
      target_frequency: (input.frequencyType === 'daily' ? 'daily' : 'custom') as Habit['target_frequency'],
      cognitive_class: input.cognitiveClass ?? 'physical',
      is_active: true,
      sort_order: habits.length,
    }
    const { data, error } = await supabase.from('habits').insert(row).select().single()
    if (error) throw new Error(error.message)
    if (data) {
      setHabits((prev) => [...prev, data])
      return data
    }
    return null
  }, [userId, habits.length, supabase])

  const createGoalWithHabits = useCallback(async (decomposition: GoalDecomposition, goalColor: string) => {
    if (!userId) throw new Error('Not signed in')
    const { data: goal, error: goalErr } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        name: decomposition.goalTitle,
        color: goalColor,
        status: 'active',
        sort_order: goals.length,
      })
      .select()
      .single()
    if (goalErr || !goal) throw new Error(goalErr?.message ?? 'Failed to create goal')

    const HABIT_ICONS = ['🎯', '💻', '📝', '🏋️', '📚', '⚡']
    for (let i = 0; i < decomposition.habits.length; i++) {
      const h = decomposition.habits[i]
      const freqType =
        h.frequencyType === 'weekly' ? 'per_week'
          : h.frequencyType === 'custom' ? 'per_week'
            : 'daily'
      await addHabit({
        name: h.title,
        icon: HABIT_ICONS[i % HABIT_ICONS.length],
        color: goalColor,
        goalId: goal.id,
        mode: h.mode,
        durationMins: h.mode === 'time_blocked' ? h.durationMins : null,
        frequencyType: freqType,
        frequencyTarget: h.frequencyTarget,
        cognitiveClass: h.cognitiveClass,
      })
    }
    setGoals((prev) => [...prev, goal])
  }, [userId, goals.length, supabase, addHabit])

  return { habits, logs, goals, isLoading, toggleHabit, addHabit, createGoalWithHabits, refresh: fetchAll }
}
