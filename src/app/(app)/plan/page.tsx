'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { usePlan } from '@/hooks/usePlan'
import { usePlanStore } from '@/stores/planStore'
import { DayTimeline } from '@/components/plan/DayTimeline'
import { CheckInBanner } from '@/components/plan/CheckInBanner'
import { UniversalInput } from '@/components/input/UniversalInput'

export default function PlanPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [showGenerateForm, setShowGenerateForm] = useState(false)
  const [sleepTime, setSleepTime] = useState('23:00')
  const [sessionMode, setSessionMode] = useState<'90_20' | '50_10'>('90_20')

  const today = format(new Date(), 'yyyy-MM-dd')
  const { plan: _plan, blocks, isLoading, isGenerating, activeCheckinBlockId, generatePlan, handleCheckin } = usePlan(userId, today)
  const { setActiveCheckinBlockId } = usePlanStore()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const activeCheckinBlock = blocks.find((b) => b.id === activeCheckinBlockId) ?? null

  const handleGenerate = async () => {
    const [h, m] = sleepTime.split(':').map(Number)
    const sleepDate = new Date()
    sleepDate.setHours(h, m, 0, 0)
    if (sleepDate < new Date()) sleepDate.setDate(sleepDate.getDate() + 1)
    await generatePlan(sleepDate.toISOString(), sessionMode)
    setShowGenerateForm(false)
  }

  const handleInput = async (input: string) => {
    if (!userId) return
    await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, context: { user_name: 'Athreya' } }),
    })
  }

  const doneBlocks = blocks.filter((b) => b.status === 'done').length
  const progress = blocks.length ? Math.round((doneBlocks / blocks.length) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 8 }}>Daily Plan</div>

        {blocks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 3, background: 'var(--bg4)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--amber)', borderRadius: 2, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{progress}%</span>
          </div>
        )}
      </div>

      {/* Check-in banner */}
      {activeCheckinBlock && (
        <CheckInBanner block={activeCheckinBlock} onResponse={handleCheckin} />
      )}

      {/* Plan or generate prompt */}
      {isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          Loading plan…
        </div>
      ) : blocks.length > 0 ? (
        <DayTimeline blocks={blocks} onCheckin={(id) => setActiveCheckinBlockId(id)} />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No plan for today yet
          </div>
          {showGenerateForm ? (
            <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Sleep time</div>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Session mode</div>
                <select
                  value={sessionMode}
                  onChange={(e) => setSessionMode(e.target.value as '90_20' | '50_10')}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none' }}
                >
                  <option value="90_20">90/20 (Deep work)</option>
                  <option value="50_10">50/10 (Lighter)</option>
                </select>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                style={{ padding: '8px 16px', background: 'var(--amber)', border: 'none', borderRadius: 8, color: '#000', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {isGenerating ? 'Generating…' : 'Generate plan'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGenerateForm(true)}
              style={{ padding: '8px 20px', background: 'var(--amber)', border: 'none', borderRadius: 8, color: '#000', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Generate today&apos;s plan
            </button>
          )}
        </div>
      )}

      {/* Universal input */}
      <div style={{ padding: '8px 16px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <UniversalInput
          placeholder="Ask about your plan, replan, or add an event…"
          onSubmit={handleInput}
        />
      </div>
    </div>
  )
}
