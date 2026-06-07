'use client'
import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { usePlan } from '@/hooks/usePlan'
import { usePlanStore } from '@/stores/planStore'
import { DayTimeline } from '@/components/plan/DayTimeline'
import { CheckInBanner } from '@/components/plan/CheckInBanner'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function PlanPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [userName, setUserName] = useState('Athreya')
  const [sleepTime, setSleepTime] = useState('23:00')
  const [sessionMode, setSessionMode] = useState<'90_20' | '50_10'>('90_20')
  const [dialValue, setDialValue] = useState(55)
  const [notesOpen, setNotesOpen] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const today = format(new Date(), 'yyyy-MM-dd')
  const { plan: _plan, blocks, isLoading, isGenerating, activeCheckinBlockId, generatePlan, handleCheckin } = usePlan(userId, today)
  const { setActiveCheckinBlockId } = usePlanStore()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        supabase.from('users').select('display_name').eq('id', user.id).single()
          .then(({ data }) => { if (data?.display_name) setUserName(data.display_name) })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeCheckinBlock = blocks.find((b) => b.id === activeCheckinBlockId) ?? null

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const handleGenerate = async () => {
    const [h, m] = sleepTime.split(':').map(Number)
    const sleepDate = new Date()
    sleepDate.setHours(h, m, 0, 0)
    if (sleepDate < new Date()) sleepDate.setDate(sleepDate.getDate() + 1)
    await generatePlan(sleepDate.toISOString(), sessionMode)
    showToast('Day assembled — blocks scheduled, deadlines safe.')
  }

  const doneBlocks = blocks.filter((b) => b.status === 'done').length
  const progress = blocks.length ? Math.round((doneBlocks / blocks.length) * 100) : 0

  const totalDiscretionary = 9.0
  const workHours = (dialValue / 100 * totalDiscretionary).toFixed(1)
  const restHours = (totalDiscretionary - parseFloat(workHours)).toFixed(1)
  const anchorLabel = dialValue > 62 ? 'Push' : dialValue < 38 ? 'Recover' : 'Balanced'

  const urgentBlocks = blocks.filter(
    (b) => b.task && (b.task.eisenhower_quadrant === 'urgent_important' || b.task.eisenhower_quadrant === 'urgent_not_important'),
  )

  const dialTrackStyle = {
    width: '100%',
    margin: '18px 0 6px',
    height: 4,
    borderRadius: 4,
    cursor: 'pointer',
    background: `linear-gradient(90deg, var(--amber) ${dialValue}%, var(--surface2) ${dialValue}%)`,
  } as const

  return (
    <>
      {/* Override apex-app to 3-col for planner */}
      <style>{`.apex-app { grid-template-columns: 236px 1fr 360px !important; }`}</style>

      {/* Center: timeline */}
      <main style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ padding: '38px 44px 0' }}>
          <div className="apex-eyebrow">{format(new Date(), 'EEEE · MMMM d')}</div>
          <div style={{ fontWeight: 900, fontSize: 40, letterSpacing: -1, lineHeight: 1.03 }}>
            {getGreeting()}, <span style={{ color: 'var(--amber)' }}>{userName}.</span>
          </div>
          <div style={{ color: 'var(--text2)', fontSize: 15, marginTop: 10 }}>
            {blocks.length > 0
              ? `${blocks.length} blocks scheduled · ${doneBlocks} done`
              : 'No plan yet — generate your day below'}
          </div>

          {/* Progress bar */}
          {blocks.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '26px 0 8px' }}>
              <div style={{ flex: 1, height: 6, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, borderRadius: 6, background: 'linear-gradient(90deg, var(--amber), var(--amber-soft))', boxShadow: '0 0 14px rgba(245,166,35,.35)', transition: 'width 1.2s cubic-bezier(.16,1,.3,1)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{progress}% · {doneBlocks}/{blocks.length} blocks</div>
            </div>
          )}
        </div>

        {/* Check-in banner */}
        {activeCheckinBlock && (
          <div style={{ padding: '0 44px' }}>
            <CheckInBanner block={activeCheckinBlock} onResponse={handleCheckin} />
          </div>
        )}

        {/* Timeline or empty state */}
        <div style={{ flex: 1, overflowY: 'auto', paddingLeft: 44, paddingRight: 44, marginTop: 16, scrollbarWidth: 'none' }}>
          {isLoading ? (
            <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '40px 0' }}>Loading…</div>
          ) : blocks.length > 0 ? (
            <DayTimeline blocks={blocks} onCheckin={(id) => setActiveCheckinBlockId(id)} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, paddingTop: 30 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 400 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Sleep time</div>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    style={{ width: '100%', padding: '9px 13px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none' }}
                  />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Session mode</div>
                  <div style={{ display: 'flex', gap: 3, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 11, padding: 3 }}>
                    {(['90_20', '50_10'] as const).map((m) => (
                      <button key={m} onClick={() => setSessionMode(m)} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, transition: 'all .18s', background: sessionMode === m ? 'rgba(245,166,35,.15)' : 'none', color: sessionMode === m ? 'var(--amber)' : 'var(--text2)' }}>
                        {m === '90_20' ? '90/20' : '50/10'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right panel */}
      <aside className="apex-planner-panel">
        {/* Work-life dial */}
        <div className="apex-card">
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 500, marginBottom: 14 }}>Work-life dial</h3>
          <div className="dial-val">
            <span className="dial-anchor">{anchorLabel}</span>{' '}
            <span className="dial-pct">· {dialValue}% invest</span>
          </div>
          <input
            type="range" min={0} max={100} value={dialValue}
            className="plan-dial"
            onChange={(e) => setDialValue(+e.target.value)}
            style={dialTrackStyle}
          />
          <div className="dial-anchors">
            <b>Recover</b>
            <span>Balanced</span>
            <span>Push</span>
            <b>Grind</b>
          </div>
          <div className="dial-preview">
            <div className="work" style={{ width: `${dialValue}%` }} />
            <div className="rest" />
          </div>
          <div className="dial-legend">
            <span>{workHours}h invest</span>
            <span>{restHours}h protected rest</span>
          </div>
        </div>

        {/* Urgent tasks today */}
        {urgentBlocks.length > 0 && (
          <div className="apex-card">
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 500, marginBottom: 14 }}>Urgent today</h3>
            <div className="plan-urgent-list">
              {urgentBlocks.map((b) => (
                <div key={b.id} className="plan-urgent-item">
                  <b>!</b>
                  <span>{b.task?.task_name ?? b.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* APEX notes */}
        <div className={`apex-card plan-notes${notesOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="plan-notes-toggle"
            onClick={() => setNotesOpen((v) => !v)}
          >
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2)', fontWeight: 500, margin: 0 }}>APEX notes</h3>
            <svg className="chev" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {notesOpen && (
            <div className="plan-notes-body">
              {blocks.length === 0 ? (
                <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '8px 0' }}>Generate a plan to see APEX reasoning here.</div>
              ) : (
                [
                  { dot: '', text: <>Urgent tasks placed in your peak window for maximum focus.</> },
                  { dot: 'blue', text: <>Deep-work blocks consolidated to protect focus time.</> },
                  { dot: 'green', text: <>Habits scheduled after high-cognitive tasks as a reset.</> },
                ].map(({ dot, text }, i) => (
                  <div key={i} className="plan-note">
                    <span className={dot ? `dot ${dot}` : 'dot'} />
                    <span>{text}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Bottom controls */}
      <div className="apex-planner-controls">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, padding: '13px 22px', borderRadius: 14, border: 'none', background: 'linear-gradient(180deg,var(--amber),#e0941a)', color: '#1a1206', cursor: 'pointer', transition: 'all .2s', opacity: isGenerating ? .6 : 1 }}
        >
          {isGenerating ? 'Generating…' : blocks.length > 0 ? 'Regenerate day' : 'Generate my day'}
        </button>
        {blocks.length > 0 && (
          <button
            onClick={async () => {
              showToast('Re-flowing your plan…')
            }}
            style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, padding: '13px 22px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', transition: 'all .2s' }}
          >
            Replan
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 92, left: '50%', transform: 'translate(-50%,0)', zIndex: 20, background: 'rgba(22,21,20,.94)', backdropFilter: 'blur(14px)', border: '1px solid var(--border-lit)', borderRadius: 14, padding: '14px 18px', fontSize: 13.5, color: 'var(--text)', boxShadow: '0 16px 50px rgba(0,0,0,.5)', maxWidth: 420, lineHeight: 1.5 }}>
          {toast}
        </div>
      )}
    </>
  )
}
