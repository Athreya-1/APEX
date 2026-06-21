'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCourses } from '@/hooks/useCourses'
import { noWorkTimesFromGuardrails, syncNoWorkGuardrails } from '@/lib/guardrails/sync'

interface Preferences {
  wake_time_default: string
  sleep_time_default: string
  session_mode: '90_20' | '50_10'
  gym_duration_cascade: number[]
  entrepreneur_daily_hours: number
  cmr_daily_hours: number
  lunch_window_start: string
  dinner_window_start: string
  shower_mins: number
  skincare_mins: number
  work_life_dial: number
  work_hour_cap: number
  deep_work_streak: number
  min_focus_block: string
  no_work_before: string
  no_work_after: string
  peak_start: string
  peak_end: string
  learn_from_behavior: boolean
  focus_check: boolean
  nightly_checkin_time: string
  habit_reminders: boolean
  plan_ready_ping: boolean
}

interface UserProfile {
  display_name: string | null
  canvas_domain: string | null
  canvas_api_token: string | null
  google_calendar_token: string | null
  email?: string | null
  timezone?: string | null
}

interface CourseWeight {
  id: string
  code: string
  name: string
  kind: 'course' | 'project'
  multiplier: number
}

const DEFAULT_PREFS: Preferences = {
  wake_time_default: '08:00',
  sleep_time_default: '00:30',
  session_mode: '90_20',
  gym_duration_cascade: [90, 60, 30],
  entrepreneur_daily_hours: 3,
  cmr_daily_hours: 3,
  lunch_window_start: '12:00',
  dinner_window_start: '19:00',
  shower_mins: 40,
  skincare_mins: 30,
  work_life_dial: 50,
  work_hour_cap: 8,
  deep_work_streak: 4,
  min_focus_block: '60m',
  no_work_before: '08:00',
  no_work_after: '22:00',
  peak_start: '09:00',
  peak_end: '12:00',
  learn_from_behavior: true,
  focus_check: true,
  nightly_checkin_time: '21:00',
  habit_reminders: true,
  plan_ready_ping: true,
}

const LOCAL_ONLY_PREFS = new Set<keyof Preferences>([
  'learn_from_behavior',
  'focus_check',
  'nightly_checkin_time',
  'habit_reminders',
  'plan_ready_ping',
])

function prefsFromDb(row: Record<string, unknown>): Preferences {
  const dialRaw = row.work_life_dial
  const dialPct = typeof dialRaw === 'number'
    ? (dialRaw <= 1 ? Math.round(dialRaw * 100) : Math.round(dialRaw))
    : DEFAULT_PREFS.work_life_dial
  const chunkMins = typeof row.min_chunk_minutes === 'number' ? row.min_chunk_minutes : 60
  return {
    ...DEFAULT_PREFS,
    ...(row as Partial<Preferences>),
    work_life_dial: dialPct,
    work_hour_cap: typeof row.daily_work_hour_cap === 'number' ? row.daily_work_hour_cap : DEFAULT_PREFS.work_hour_cap,
    deep_work_streak: typeof row.max_consecutive_heavy === 'number' ? row.max_consecutive_heavy : DEFAULT_PREFS.deep_work_streak,
    min_focus_block: `${chunkMins}m`,
  }
}

function prefToDbPayload<K extends keyof Preferences>(key: K, value: Preferences[K]): Record<string, unknown> | null {
  if (LOCAL_ONLY_PREFS.has(key)) return null
  switch (key) {
    case 'work_life_dial':
      return { work_life_dial: (value as number) / 100 }
    case 'work_hour_cap':
      return { daily_work_hour_cap: value }
    case 'deep_work_streak':
      return { max_consecutive_heavy: value }
    case 'min_focus_block':
      return { min_chunk_minutes: parseInt(String(value), 10) || 60 }
    case 'no_work_before':
    case 'no_work_after':
      return null
    default:
      return { [key]: value }
  }
}

function dialAnchorLabel(value: number): string {
  if (value > 85) return 'Grind'
  if (value > 62) return 'Push'
  if (value < 38) return 'Recover'
  return 'Balanced'
}

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'profile' as const },
  { id: 'rhythm', label: 'Daily rhythm', icon: 'M12 3a9 9 0 100 18A9 9 0 0012 3zM12 7v5l3 2' },
  { id: 'focus', label: 'Work & focus', icon: 'focus' as const },
  { id: 'courses', label: 'Courses & weights', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'learning', label: 'Adaptive learning', icon: 'M12 3l8 4-8 4-8-4 8-4zM4 11l8 4 8-4M4 15l8 4 8-4' },
  { id: 'integrations', label: 'Integrations', icon: 'M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1' },
  { id: 'notifications', label: 'Notifications', icon: 'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0' },
]

function calcWakeFromBedtime(bedtime: string, sleepHours: number): string {
  const [h, m] = bedtime.split(':').map(Number)
  const total = (h * 60 + m + sleepHours * 60) % (24 * 60)
  const wh = Math.floor(total / 60)
  const wm = Math.round(total % 60)
  const ap = wh >= 12 ? 'PM' : 'AM'
  const h12 = wh % 12 || 12
  return `${h12}:${String(wm).padStart(2, '0')} ${ap}`
}

function NavIcon({ icon }: { icon: string | 'profile' | 'focus' }) {
  if (icon === 'profile') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    )
  }
  if (icon === 'focus') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d={icon} />
    </svg>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`settings-toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <span className="knob" />
    </button>
  )
}

function SegBtn({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="settings-seg">
      {options.map((opt) => (
        <button key={opt} type="button" className={value === opt ? 'on' : ''} onClick={() => onChange(opt)}>
          {opt}
        </button>
      ))}
    </div>
  )
}

function Stepper({ value, min, max, step, unit, onChange }: { value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)))
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(2)))
  const display = value % 1 ? value : value
  return (
    <div className="settings-stepper">
      <button type="button" onClick={dec} aria-label="Decrease">−</button>
      <span className="sval">{display}{unit}</span>
      <button type="button" onClick={inc} aria-label="Increase">+</button>
    </div>
  )
}

function SRow({ label, desc, children, disabled }: { label: React.ReactNode; desc?: React.ReactNode; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div className={`settings-srow${disabled ? ' disabled' : ''}`}>
      <div className="settings-srow-l">
        <div className="lab">{label}</div>
        {desc != null && <div className="desc">{desc}</div>}
      </div>
      <div className="settings-srow-c">{children}</div>
    </div>
  )
}

function SGroup({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="settings-sgroup">
      <div className="settings-sgroup-head">
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      {children}
    </section>
  )
}

function SoonBadge() {
  return <span className="settings-badge">soon</span>
}

export default function SettingsPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [profile, setProfile] = useState<UserProfile>({
    display_name: 'Athreya',
    canvas_domain: 'canvas.cmu.edu',
    canvas_api_token: '',
    google_calendar_token: null,
    email: 'athreya@cmu.edu',
    timezone: 'America/New_York (ET)',
  })
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [courseWeights, setCourseWeights] = useState<CourseWeight[]>([])
  const [sleepHours, setSleepHours] = useState(8.5)
  const [lunchMins, setLunchMins] = useState(45)
  const [dinnerMins, setDinnerMins] = useState(60)
  const [activeSection, setActiveSection] = useState('profile')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [addCourseOpen, setAddCourseOpen] = useState(false)
  const [newCourseName, setNewCourseName] = useState('')
  const [newCourseCode, setNewCourseCode] = useState('')
  const mainRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { courses: dbCourses, refresh: refreshCourses } = useCourses(userId)

  useEffect(() => {
    setCourseWeights(dbCourses.map((c) => ({
      id: c.id,
      code: c.code?.trim() || c.name.slice(0, 8).toUpperCase(),
      name: c.name,
      kind: (c.code?.toUpperCase() === 'CMR' || c.name.toLowerCase().includes('racing')) ? 'project' as const : 'course' as const,
      multiplier: c.difficulty_multiplier ?? 1.0,
    })))
  }, [dbCourses])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        Promise.all([
          supabase.from('users').select('display_name,canvas_domain,canvas_api_token,google_calendar_token,email,timezone').eq('id', user.id).single(),
          supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
          supabase.from('guardrails').select('*').eq('user_id', user.id).eq('is_active', true),
        ]).then(([{ data: userData }, { data: prefsData }, { data: guardrailData }]) => {
          if (userData) setProfile((p) => ({ ...p, ...userData }))
          if (prefsData) {
            setPrefs(prefsFromDb(prefsData))
            if (prefsData.sleep_buffer_hours) setSleepHours(prefsData.sleep_buffer_hours)
            if (prefsData.lunch_duration_mins) setLunchMins(prefsData.lunch_duration_mins)
            if (prefsData.dinner_duration_mins) setDinnerMins(prefsData.dinner_duration_mins)
          }
          if (guardrailData?.length) {
            const { no_work_before, no_work_after } = noWorkTimesFromGuardrails(guardrailData)
            setPrefs((p) => ({
              ...p,
              ...(no_work_before ? { no_work_before } : {}),
              ...(no_work_after ? { no_work_after } : {}),
            }))
          }
        })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = useCallback((msg = 'Saved · changes apply to your next plan') => {
    setToastMsg(msg)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setToastMsg(null), 2200)
  }, [])

  const savePref = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((p) => {
      const next = { ...p, [key]: value }
      if (userId) {
        const payload = prefToDbPayload(key, value)
        if (payload) {
          supabase.from('user_preferences').upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' }).then(() => showToast())
        } else if (key === 'no_work_before' || key === 'no_work_after') {
          syncNoWorkGuardrails(supabase, userId, next.no_work_before, next.no_work_after).then(() => showToast())
        } else {
          showToast()
        }
      } else {
        showToast()
      }
      return next
    })
  }, [userId, supabase, showToast])

  const saveProfile = useCallback(<K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }))
    if (userId) {
      supabase.from('users').update({ [key]: value }).eq('id', userId).then(() => showToast())
    } else {
      showToast()
    }
  }, [userId, supabase, showToast])

  const removeCourse = useCallback(async (id: string) => {
    setCourseWeights((cs) => cs.filter((c) => c.id !== id))
    if (userId) {
      await supabase.from('courses').update({ is_active: false }).eq('id', id).eq('user_id', userId)
      await refreshCourses()
      showToast('Course removed')
    } else {
      showToast('Course removed')
    }
  }, [userId, supabase, refreshCourses, showToast])

  const handleAddCourse = useCallback(async () => {
    const name = newCourseName.trim()
    if (!name) return
    if (!userId) {
      showToast('Course added')
      setAddCourseOpen(false)
      return
    }
    const { error } = await supabase.from('courses').insert({
      user_id: userId,
      name,
      code: newCourseCode.trim() || null,
      color: 'var(--amber)',
      is_active: true,
      difficulty_multiplier: 1.0,
    })
    if (error) {
      showToast(error.message)
      return
    }
    await refreshCourses()
    setNewCourseName('')
    setNewCourseCode('')
    setAddCourseOpen(false)
    showToast('Course added')
  }, [userId, newCourseName, newCourseCode, supabase, refreshCourses, showToast])

  const wakeFromBed = calcWakeFromBedtime(prefs.sleep_time_default, sleepHours)
  const streakFocus = prefs.deep_work_streak * 1.5
  const streakElapsed = Math.round((streakFocus + (prefs.deep_work_streak - 1) * (20 / 60)) * 10) / 10
  const dialLabel = dialAnchorLabel(prefs.work_life_dial)

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const secs = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActiveSection(en.target.id) })
    }, { root: el, rootMargin: '-10% 0px -70% 0px', threshold: 0 })
    secs.forEach((s) => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  return (
    <main ref={mainRef} className="apex-main" style={{ overflowY: 'auto', height: '100vh' }}>
      <div className="apex-eyebrow">Preferences</div>
      <h1 className="apex-h1">Settings</h1>
      <p className="settings-subline">
        Tune how APEX plans your days. Everything here feeds the scheduling engine — and it learns the rest.
      </p>

      <div className="settings-swrap">
        <nav className="settings-snav">
          {SECTIONS.map(({ id, label, icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className={activeSection === id ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                setActiveSection(id)
              }}
            >
              <NavIcon icon={icon} />
              {label}
            </a>
          ))}
        </nav>

        <div className="settings-smain">
          <SGroup id="profile" title="Profile" desc="The basics. Used for greetings and time math.">
            <SRow label="Name">
              <input className="settings-tinput" value={profile.display_name ?? ''} onChange={(e) => saveProfile('display_name', e.target.value)} />
            </SRow>
            <SRow label="Email">
              <input className="settings-tinput" value={profile.email ?? ''} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
            </SRow>
            <SRow label="Time zone" desc="All deadlines and blocks resolve against this.">
              <select className="settings-sel" value={profile.timezone ?? 'America/New_York (ET)'} onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}>
                <option>America/New_York (ET)</option>
                <option>America/Chicago (CT)</option>
                <option>America/Denver (MT)</option>
                <option>America/Los_Angeles (PT)</option>
              </select>
            </SRow>
          </SGroup>

          <SGroup id="rhythm" title="Daily rhythm" desc="The fixed skeleton APEX always protects and never schedules work over.">
            <SRow
              label="Bedtime & sleep"
              desc={<>Wake <b>{wakeFromBed}</b> · {sleepHours}h sleep protected.</>}
            >
              <input type="time" className="settings-timefield" value={prefs.sleep_time_default} onChange={(e) => savePref('sleep_time_default', e.target.value)} />
              <Stepper value={sleepHours} min={6} max={10} step={0.5} unit="h" onChange={(v) => { setSleepHours(v); showToast() }} />
            </SRow>
            <SRow label="Sharpest window" desc="When deep work gets placed first — same start/end you set in onboarding. APEX can relearn this from your real focus data.">
              <input type="time" className="settings-timefield" value={prefs.peak_start} onChange={(e) => savePref('peak_start', e.target.value)} />
              <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>–</span>
              <input type="time" className="settings-timefield" value={prefs.peak_end} onChange={(e) => savePref('peak_end', e.target.value)} />
            </SRow>
            <SRow label="Morning routine" desc="Shower, prep — held every morning after wake.">
              <Stepper value={prefs.shower_mins} min={10} max={90} step={5} unit="m" onChange={(v) => savePref('shower_mins', v)} />
            </SRow>
            <SRow label="Lunch">
              <Stepper value={lunchMins} min={15} max={90} step={5} unit="m" onChange={(v) => { setLunchMins(v); showToast() }} />
            </SRow>
            <SRow label="Dinner" desc="Ends ≥ 2h before bedtime.">
              <Stepper value={dinnerMins} min={20} max={120} step={5} unit="m" onChange={(v) => { setDinnerMins(v); showToast() }} />
            </SRow>
            <SRow label="Evening wind-down" desc="Skincare + decompress before sleep.">
              <Stepper value={prefs.skincare_mins} min={0} max={60} step={5} unit="m" onChange={(v) => savePref('skincare_mins', v)} />
            </SRow>
          </SGroup>

          <SGroup id="focus" title="Work & focus" desc="The core engine levers. Sensible defaults are set — adjust if you know your own rhythm.">
            <div className="settings-srow col">
              <div className="settings-dialhead">
                <span className="dtitle">Work–life balance</span>
                <span className="dnow">{dialLabel} · {prefs.work_life_dial}% invest / {100 - prefs.work_life_dial}% protect</span>
              </div>
              <input
                type="range"
                className="settings-dial"
                min={0}
                max={100}
                value={prefs.work_life_dial}
                onChange={(e) => savePref('work_life_dial', +e.target.value)}
              />
              <div className="settings-dialscale">
                <span><b>Protect rest</b> · more free time</span>
                <span>more progress · <b>Invest</b></span>
              </div>
              <div className="desc" style={{ marginTop: 2 }}>
                Splits only your <b>leftover</b> time after commitments. Committed work and deadlines are always protected.
              </div>
            </div>

            <SRow label="Daily work-hour cap" desc="Burnout guard. Respected normally — a hard deadline can breach it with a loud warning.">
              <input type="range" className="settings-srange" min={2} max={14} step={0.5} value={prefs.work_hour_cap} onChange={(e) => savePref('work_hour_cap', +e.target.value)} />
              <span className="settings-rangeval">{prefs.work_hour_cap % 1 ? prefs.work_hour_cap : prefs.work_hour_cap}h</span>
            </SRow>

            <SRow label="Focus session rhythm" desc="Focus / break cadence inside a work block.">
              <SegBtn
                options={['90 / 20', '50 / 10']}
                value={prefs.session_mode === '90_20' ? '90 / 20' : '50 / 10'}
                onChange={(v) => savePref('session_mode', v === '90 / 20' ? '90_20' : '50_10')}
              />
            </SRow>

            <SRow label="Max deep-work streak" desc="How long on one heavy task before APEX forces a contrasting block. Micro-breaks still happen within.">
              <input type="range" className="settings-srange" min={2} max={6} step={1} value={prefs.deep_work_streak} onChange={(e) => savePref('deep_work_streak', +e.target.value)} />
              <span className="settings-rangeval wide">{prefs.deep_work_streak} · ≈{streakFocus % 1 ? streakFocus : streakFocus}h / ~{streakElapsed}h</span>
            </SRow>

            <SRow label="Minimum focus block" desc="Heavy work is never scheduled in holes smaller than this.">
              <SegBtn options={['30m', '45m', '60m', '90m']} value={prefs.min_focus_block} onChange={(v) => savePref('min_focus_block', v)} />
            </SRow>

            <SRow label="No work before" desc="Hard lower bound — the planner won&apos;t place tasks earlier.">
              <input type="time" className="settings-timefield" value={prefs.no_work_before} onChange={(e) => savePref('no_work_before', e.target.value)} />
            </SRow>
            <SRow label="No work after" desc="Hard upper bound for task placement.">
              <input type="time" className="settings-timefield" value={prefs.no_work_after} onChange={(e) => savePref('no_work_after', e.target.value)} />
            </SRow>
          </SGroup>

          <SGroup id="courses" title="Courses & weights" desc="Difficulty multiplier per course/project. Harder ones get scheduled earlier and earn more runway before deadlines.">
            {courseWeights.length === 0 && (
              <div className="settings-courserow">
                <span className="settings-cname" style={{ color: 'var(--text3)' }}>No courses yet — add them during onboarding or below.</span>
              </div>
            )}
            {courseWeights.map((c) => (
              <div key={c.id} className="settings-courserow">
                <span className={`settings-ctag ${c.kind}`}>{c.code}</span>
                <span className="settings-cname">{c.name}</span>
                <input
                  type="range"
                  className="settings-srange narrow"
                  min={0.7}
                  max={1.5}
                  step={0.1}
                  value={c.multiplier}
                  onChange={(e) => {
                    const multiplier = +e.target.value
                    setCourseWeights((cs) => cs.map((x) => (x.id === c.id ? { ...x, multiplier } : x)))
                    if (userId) supabase.from('courses').update({ difficulty_multiplier: multiplier }).eq('id', c.id).then(() => showToast())
                    else showToast()
                  }}
                />
                <span className="settings-multitag">{c.multiplier.toFixed(1)}×</span>
                <button type="button" className="settings-courseremove" onClick={() => removeCourse(c.id)} aria-label={`Remove ${c.name}`}>
                  ×
                </button>
              </div>
            ))}
            {addCourseOpen ? (
              <div className="settings-courserow" style={{ flexWrap: 'wrap', gap: 10 }}>
                <input
                  type="text"
                  className="settings-timefield"
                  placeholder="Course or project name"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  style={{ flex: '2 1 180px' }}
                />
                <input
                  type="text"
                  className="settings-timefield"
                  placeholder="Code (optional)"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  style={{ flex: '1 1 100px' }}
                />
                <button type="button" className="settings-ghostbtn" onClick={() => { void handleAddCourse() }}>
                  Save
                </button>
                <button type="button" className="settings-ghostbtn" onClick={() => { setAddCourseOpen(false); setNewCourseName(''); setNewCourseCode('') }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="settings-ghostbtn settings-addcourse" onClick={() => setAddCourseOpen(true)}>
                + Add course or project
              </button>
            )}
          </SGroup>

          <SGroup id="learning" title="Adaptive learning" desc="APEX optimizes for what you actually do, not what you say. Keep these on to let it sharpen over time.">
            <SRow label="Learn from my behavior" desc="Tracks calendar drift and effort actuals to calibrate estimates and timing. Nothing leaves your account.">
              <Toggle on={prefs.learn_from_behavior} onChange={(v) => savePref('learn_from_behavior', v)} />
            </SRow>
            <SRow label="Occasional focus check" desc="A one-tap 1–5 rating on a sampled session to map your real energy curve.">
              <Toggle on={prefs.focus_check} onChange={(v) => savePref('focus_check', v)} />
            </SRow>
            <SRow label={<>Auto-shift my peak window <SoonBadge /></>} desc="Once enough data is gathered, APEX moves deep work to when you're genuinely sharpest." disabled>
              <Toggle on={false} onChange={() => {}} />
            </SRow>
          </SGroup>

          <SGroup id="integrations" title="Integrations" desc="Where APEX reads your commitments and writes your plan.">
            <SRow label="Google Calendar" desc="Reads events as busy time, writes [APEX] focus blocks back.">
              <span className="settings-pillstat">
                <span className="dot" style={{ background: profile.google_calendar_token ? 'var(--green)' : 'var(--text3)' }} />
                {profile.google_calendar_token ? 'Connected' : 'Not connected'}
              </span>
              <button
                type="button"
                className="settings-ghostbtn"
                onClick={async () => {
                  if (profile.google_calendar_token) {
                    if (userId) {
                      await supabase.from('users').update({ google_calendar_token: null, google_calendar_refresh_token: null }).eq('id', userId)
                      setProfile((p) => ({ ...p, google_calendar_token: null }))
                      showToast('Disconnected')
                    }
                  } else {
                    await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: {
                        scopes: 'https://www.googleapis.com/auth/calendar',
                        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
                        queryParams: { access_type: 'offline', prompt: 'consent' },
                      },
                    })
                  }
                }}
              >
                {profile.google_calendar_token ? 'Disconnect' : 'Connect'}
              </button>
            </SRow>
            <SRow label="Notion import" desc="Map a Notion database to your To-Do — keeps your custom fields.">
              <button type="button" className="settings-ghostbtn" onClick={() => showToast('Import started')}>
                Import tasks
              </button>
            </SRow>
            <SRow label={<>Canvas <SoonBadge /></>} desc="Auto-pull assignments and due dates from your courses." disabled>
              <span className="settings-soon">Coming soon</span>
            </SRow>
          </SGroup>

          <SGroup id="notifications" title="Notifications" desc="Gentle nudges, never noisy.">
            <SRow label="Nightly check-in" desc="Reflect on the day and prep tomorrow's plan.">
              <input type="time" className="settings-timefield" value={prefs.nightly_checkin_time} onChange={(e) => savePref('nightly_checkin_time', e.target.value)} />
            </SRow>
            <SRow label="Habit reminders" desc="Computed nudge times for check-off habits.">
              <Toggle on={prefs.habit_reminders} onChange={(v) => savePref('habit_reminders', v)} />
            </SRow>
            <SRow label="Plan-ready ping" desc="A ping when tomorrow's schedule is built.">
              <Toggle on={prefs.plan_ready_ping} onChange={(v) => savePref('plan_ready_ping', v)} />
            </SRow>
          </SGroup>
        </div>
      </div>

      <div className={`settings-toast${toastMsg ? ' show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </main>
  )
}
