'use client'
import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePlanStore } from '@/stores/planStore'
import type { DailyPlan, PlanBlock } from '@/types'

export function usePlan(userId: string | undefined, planDate: string) {
  const {
    plan, blocks, isLoading, isGenerating, activeCheckinBlockId, error,
    setPlan, setBlocks, updateBlock, setLoading, setGenerating, setError, setActiveCheckinBlockId,
  } = usePlanStore()

  const fetchPlan = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data: planData } = await supabase
      .from('daily_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_date', planDate)
      .single()

    if (planData) {
      setPlan(planData as DailyPlan)

      const { data: blockData } = await supabase
        .from('plan_blocks')
        .select('*, task:tasks(*, course:courses(id,name,color))')
        .eq('plan_id', planData.id)
        .order('sort_order')

      if (blockData) {
        setBlocks(blockData.map(({ task, ...block }) => ({ ...block, task: task ?? undefined })) as PlanBlock[])
      }
    } else {
      setPlan(null)
      setBlocks([])
    }
    setLoading(false)
  }, [userId, planDate, setPlan, setBlocks, setLoading, setError])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  const generatePlan = useCallback(
    async (
      sleepTime: string,
      sessionMode: '90_20' | '50_10',
      options?: { workLifeDial?: number },
    ) => {
      if (!userId) return
      setGenerating(true)
      setError(null)
      try {
        const res = await fetch('/api/plan/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_date: planDate,
            sleep_time: sleepTime,
            session_mode: sessionMode,
            work_life_dial: options?.workLifeDial,
          }),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          setError(`Plan generation failed (${res.status})${text ? ': ' + text.slice(0, 120) : ''}`)
          return
        }
        const data = await res.json().catch(() => ({}))
        if (data.error) {
          setError(data.error)
        } else {
          await fetchPlan()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate plan')
      } finally {
        setGenerating(false)
      }
    },
    [userId, planDate, fetchPlan, setGenerating, setError],
  )

  const replanDay = useCallback(async () => {
    if (!userId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/plan/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_date: planDate, from_time: new Date().toISOString() }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setError(`Replan failed (${res.status})${text ? ': ' + text.slice(0, 120) : ''}`)
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data.error) {
        setError(data.error)
      } else {
        await fetchPlan()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replan')
    } finally {
      setGenerating(false)
    }
  }, [userId, planDate, fetchPlan, setGenerating, setError])

  const handleCheckin = useCallback(
    async (blockId: string, choice: 'done' | '+15' | '+30' | '+45' | '+60' | 'custom', extraMins?: number) => {
      const supabase = createClient()
      updateBlock(blockId, {
        status: choice === 'done' ? 'done' : 'scheduled',
        checkin_response: { choice, extra_mins: extraMins ?? 0 },
        checkin_done_at: new Date().toISOString(),
      })

      await supabase
        .from('plan_blocks')
        .update({
          status: choice === 'done' ? 'done' : 'scheduled',
          checkin_response: { choice, extra_mins: extraMins ?? 0 },
          checkin_done_at: new Date().toISOString(),
        })
        .eq('id', blockId)

      setActiveCheckinBlockId(null)

      if (choice !== 'done' && extraMins) {
        // Trigger micro-replan when block needs extra time
        const res = await fetch('/api/plan/replan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ block_id: blockId, extra_mins: extraMins, plan_date: planDate }),
        }).catch(() => null)
        if (!res?.ok) {
          console.warn('[usePlan] replan request failed:', res?.status)
        }
        await fetchPlan()
      }
    },
    [updateBlock, setActiveCheckinBlockId, fetchPlan, planDate],
  )

  return {
    plan, blocks, isLoading, isGenerating, activeCheckinBlockId, error,
    generatePlan, replanDay, handleCheckin, refetch: fetchPlan,
  }
}
