'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHabits } from '@/hooks/useHabits'
import { WeekStrip, WeekLegend, buildTrackItems } from '@/components/habits/WeekStrip'
import { HabitCard } from '@/components/habits/HabitCard'
import { DecompModal } from '@/components/habits/DecompModal'
import { HabitsInputBar } from '@/components/habits/HabitsInputBar'

const GOAL_COLORS = ['var(--amber)', 'var(--violet)', 'var(--blue)', 'var(--green)', 'var(--pink)']
const HABIT_COLORS = ['var(--blue)', 'var(--green)', 'var(--pink)', 'var(--amber)', 'var(--violet)']

export default function HabitsPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [decompOpen, setDecompOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { habits, logs, goals, isLoading, toggleHabit, addHabit, createGoalWithHabits, refresh } = useHabits(userId)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  const handleInputSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    if (/^(new goal|goal:?\s)/i.test(trimmed)) {
      setDecompOpen(true)
      return
    }

    const exactMatch = habits.find((h) => h.name.toLowerCase() === trimmed.toLowerCase())
    const fuzzyMatch = habits.find((h) => h.name.toLowerCase().includes(trimmed.toLowerCase()))
    const habitMatch = exactMatch ?? (trimmed.length >= 3 ? fuzzyMatch : undefined)

    if (habitMatch) {
      const done = logs.some((l) => l.habit_id === habitMatch.id && l.logged_date === today && l.completed)
      await toggleHabit(habitMatch.id, !done)
      showToast(done ? `Unmarked ${habitMatch.name}` : `Logged ${habitMatch.name}`)
      return
    }

    if (!trimmed.includes('?') && trimmed.length <= 80) {
      await addHabit({ name: trimmed })
      showToast(`Added habit: ${trimmed}`)
      return
    }

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: trimmed,
          context: { habits: habits.map((h) => h.name) },
        }),
      })
      const data = await res.json()
      if (data.action === 'add_habit_log') {
        await refresh()
        showToast(`Logged ${(data.result as { habit_name?: string })?.habit_name ?? 'habit'}`)
        return
      }
      if (data.action === 'clarify' && data.question) {
        showToast(data.question)
        return
      }
      if (data.action === 'error') {
        showToast(typeof data.result === 'string' ? data.result : 'Could not process that request')
        return
      }
      showToast('Done')
      await refresh()
    } catch {
      await addHabit({ name: trimmed })
      showToast(`Added habit: ${trimmed}`)
    }
  }, [habits, logs, today, toggleHabit, addHabit, refresh, showToast])

  const overallStreak = useMemo(() => {
    let streak = 0
    const check = new Date()
    check.setHours(0, 0, 0, 0)
    while (logs.some((l) => l.logged_date === format(check, 'yyyy-MM-dd') && l.completed)) {
      streak++
      check.setDate(check.getDate() - 1)
    }
    return streak
  }, [logs])

  const habitsDoneToday = habits.filter((h) =>
    logs.some((l) => l.habit_id === h.id && l.logged_date === today && l.completed),
  ).length

  const standalone = habits.filter((h) => !h.goal_id)
  const habitsByGoal = goals.map((g, gi) => ({
    goal: g,
    colorClass: gi % 2 === 1 ? ' violet' : '',
    habits: habits.filter((h) => h.goal_id === g.id),
  })).filter((g) => g.habits.length > 0)

  const trackItems = useMemo(
    () => buildTrackItems(goals, habits, GOAL_COLORS, HABIT_COLORS),
    [goals, habits],
  )

  const handleGoalCreated = useCallback(async (decomposition: Parameters<typeof createGoalWithHabits>[0]) => {
    const color = GOAL_COLORS[goals.length % GOAL_COLORS.length]
    await createGoalWithHabits(decomposition, color)
  }, [createGoalWithHabits, goals.length])

  return (
    <main className="apex-main" style={{ paddingBottom: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="apex-eyebrow">
            {goals.length} goal{goals.length === 1 ? '' : 's'} · {habits.length} habit{habits.length === 1 ? '' : 's'}
            {habits.length > 0 && ` · ${habitsDoneToday}/${habits.length} done today`}
          </div>
          <h1 className="apex-h1">Habits</h1>
        </div>
        {overallStreak > 0 && (
          <div className="streakpill">🔥 {overallStreak}-day streak</div>
        )}
      </div>

      <WeekStrip trackItems={trackItems} logs={logs} />
      <WeekLegend trackItems={trackItems} />

      {isLoading && habits.length === 0 && (
        <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 24 }}>
          Loading habits…
        </div>
      )}

      {habitsByGoal.length > 0 && (
        <>
          <div className="section-label">Goals</div>
          {habitsByGoal.map(({ goal, colorClass, habits: gh }) => (
            <div key={goal.id} className={`goal-card${colorClass}`}>
              <div className="goal-head">
                <span className="goal-ic">🎯</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.4 }}>{goal.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                    {gh.length} linked habit{gh.length === 1 ? '' : 's'}
                    {goal.deadline ? ` · target ${goal.deadline}` : ''}
                  </div>
                </div>
              </div>
              <div className="habits-in">
                {gh.map((h) => (
                  <HabitCard key={h.id} habit={h} logs={logs} onToggle={toggleHabit} accentColor={goal.color} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <button
        type="button"
        className="add-goal"
        onClick={() => setDecompOpen(true)}
      >
        + New goal
      </button>

      {standalone.length > 0 && (
        <>
          <div className="section-label">Standalone habits</div>
          <div className="standalone-grid">
            {standalone.map((h, i) => (
              <HabitCard
                key={h.id}
                habit={h}
                logs={logs}
                onToggle={toggleHabit}
                accentColor={h.color ?? HABIT_COLORS[i % HABIT_COLORS.length]}
              />
            ))}
          </div>
        </>
      )}

      {!isLoading && habits.length === 0 && (
        <div style={{ marginTop: 24, color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
          No habits yet. Add a goal above or complete onboarding to import your recurring commitments.
        </div>
      )}

      <DecompModal
        open={decompOpen}
        onClose={() => setDecompOpen(false)}
        onConfirm={handleGoalCreated}
      />

      <HabitsInputBar onSubmit={handleInputSubmit} loading={isLoading} />

      {toast && (
        <div className={`apex-toast show`} style={{ bottom: 100 }}>
          {toast}
        </div>
      )}
    </main>
  )
}
