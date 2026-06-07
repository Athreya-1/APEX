'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useHabits } from '@/hooks/useHabits'
import { WeekStrip, WeekLegend, buildTrackItems } from '@/components/habits/WeekStrip'
import { HabitCard } from '@/components/habits/HabitCard'
import { DecompModal } from '@/components/habits/DecompModal'

const GOAL_COLORS = ['var(--amber)', 'var(--violet)', 'var(--blue)', 'var(--green)', 'var(--pink)']
const HABIT_COLORS = ['var(--blue)', 'var(--green)', 'var(--pink)', 'var(--amber)', 'var(--violet)']

export default function HabitsPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [decompOpen, setDecompOpen] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { habits, logs, goals, isLoading, toggleHabit, createGoalWithHabits } = useHabits(userId)

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
    </main>
  )
}
