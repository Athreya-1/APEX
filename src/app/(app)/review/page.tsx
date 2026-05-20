'use client'
import { useEffect, useState } from 'react'
import { format, subDays, startOfWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { WeekStats } from '@/components/review/WeekStats'
import { AccuracyTable } from '@/components/review/AccuracyTable'
import { DeepWorkChart } from '@/components/review/DeepWorkChart'
import { ApexInsight } from '@/components/review/ApexInsight'
import { UniversalInput } from '@/components/input/UniversalInput'
import type { TaskEffortHistory } from '@/types'

export default function ReviewPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [history, setHistory] = useState<TaskEffortHistory[]>([])
  const [deepWorkByDay, setDeepWorkByDay] = useState<Array<{ date: string; hours: number }>>([])
  const [insight, setInsight] = useState<string>('Loading your weekly analysis…')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [])

  useEffect(() => {
    if (!userId) return
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')

    Promise.all([
      supabase.from('task_effort_history').select('*').eq('user_id', userId)
        .gte('completed_at', weekStartStr).order('completed_at', { ascending: false }),
      supabase.from('plan_blocks').select('start_time, end_time, block_type, status')
        .eq('status', 'done').in('block_type', ['deep_work', 'entrepreneur'])
        .gte('start_time', format(subDays(new Date(), 7), 'yyyy-MM-dd')),
    ]).then(([{ data: histData }, { data: blockData }]) => {
      if (histData) setHistory(histData)

      // Aggregate deep work by day
      const byDay: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
        byDay[d] = 0
      }
      for (const b of blockData ?? []) {
        const day = b.start_time.slice(0, 10)
        if (day in byDay) {
          const mins = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000
          byDay[day] = (byDay[day] ?? 0) + mins / 60
        }
      }
      setDeepWorkByDay(Object.entries(byDay).map(([date, hours]) => ({ date, hours: Math.round(hours * 10) / 10 })))
    })
  }, [userId])

  // Compute stats
  const tasksCompleted = history.length
  const accuracyItems = history.filter((h) => h.estimated_hours && h.actual_hours)
  const avgAccuracy = accuracyItems.length
    ? Math.round(accuracyItems.reduce((sum, h) => {
        const ratio = Math.min(h.estimated_hours!, h.actual_hours!) / Math.max(h.estimated_hours!, h.actual_hours!)
        return sum + ratio * 100
      }, 0) / accuracyItems.length)
    : 0
  const totalDeepWork = deepWorkByDay.reduce((s, d) => s + d.hours, 0)

  // Generate insight client-side
  useEffect(() => {
    if (!history.length) return
    const overEstimate = history.filter((h) => (h.actual_hours ?? 0) > (h.estimated_hours ?? 0))
    if (overEstimate.length > history.length * 0.6) {
      setInsight(`You ran over estimate on ${overEstimate.length}/${history.length} tasks this week. APEX is adjusting future estimates upward for these task types.`)
    } else if (avgAccuracy >= 85) {
      setInsight(`Strong week — ${avgAccuracy}% estimate accuracy. Your historical calibration is excellent. Keep tagging task types for even better future predictions.`)
    } else {
      setInsight(`Completed ${tasksCompleted} tasks with ${avgAccuracy}% estimate accuracy and ${totalDeepWork.toFixed(1)}h of deep work.`)
    }
  }, [history, avgAccuracy, tasksCompleted, totalDeepWork])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>Review</span>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')} — {format(new Date(), 'MMM d')}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0', scrollbarWidth: 'none' }}>
        <WeekStats tasksCompleted={tasksCompleted} estimateAccuracy={avgAccuracy} deepWorkHours={Math.round(totalDeepWork * 10) / 10} />
        <div style={{ padding: '0 16px 16px' }}>
          <AccuracyTable history={history} />
          <DeepWorkChart data={deepWorkByDay} />
          <ApexInsight insight={insight} />
        </div>
      </div>

      <div style={{ padding: '8px 16px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <UniversalInput placeholder="Ask about your week or any past data…" onSubmit={async () => {}} />
      </div>
    </div>
  )
}
