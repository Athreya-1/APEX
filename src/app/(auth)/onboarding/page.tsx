'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  EST_STOPS,
  formatEstimateHours,
  hoursFromStopIndex,
  nearestStopIndex,
} from '@/lib/tasks/estimate-stops'
import type { Habit } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────
interface CourseInput {
  name: string
  code: string
  color: string
  difficulty: number
}

interface CommitmentInput {
  name: string
  days_per_week: number
  duration_stop_index: number
}

interface OnboardingData {
  display_name: string
  timezone: string
  wake_time: string
  sleep_time: string
  peak_start: string
  peak_end: string
  morning_prep_mins: number
  lunch_window_start: string
  dinner_window_start: string
  wind_down_mins: number
  courses: CourseInput[]
  commitments: CommitmentInput[]
  session_mode: '90_20' | '50_10'
  canvas_domain: string
  canvas_api_token: string
}

// ── Constants ──────────────────────────────────────────────────────────────────
const COURSE_COLORS = [
  'var(--amber)',
  'var(--blue)',
  'var(--green)',
  'var(--pink)',
  'var(--purple)',
  'var(--red)',
]

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'schedule', label: 'Your day' },
  { id: 'routines', label: 'Routines' },
  { id: 'courses', label: 'Courses' },
  { id: 'commitments', label: 'Commitments' },
  { id: 'launch', label: 'Launch' },
]

// ── Style helpers ─────────────────────────────────────────────────────────────
const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: 8,
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const label: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text3)',
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  display: 'block',
  marginBottom: 5,
}

const fieldset = (cols = 1): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gap: 12,
})

function Label({ children }: { children: React.ReactNode }) {
  return <span style={label}>{children}</span>
}

function Field({
  label: l,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Label>{l}</Label>
      {children}
    </div>
  )
}

function RangeRow({
  label: l,
  value,
  min,
  max,
  step = 1,
  unit,
  fmt,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  fmt?: (v: number) => string
  onChange: (v: number) => void
}) {
  const display = fmt ? fmt(value) : `${value}${unit ?? ''}`
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <Label>{l}</Label>
        <span
          style={{
            fontSize: 13,
            color: 'var(--amber)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
        >
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--amber)' }}
      />
    </div>
  )
}

/** Log-scaled duration slider — same stop curve as task estimate slider. */
function LogRangeRow({
  label: l,
  stopIndex,
  onChange,
}: {
  label: string
  stopIndex: number
  onChange: (index: number) => void
}) {
  const hours = hoursFromStopIndex(stopIndex)
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <Label>{l}</Label>
        <span
          style={{
            fontSize: 13,
            color: 'var(--amber)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
        >
          {formatEstimateHours(hours)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={EST_STOPS.length - 1}
        step={1}
        value={stopIndex}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--amber)' }}
        aria-label={l}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text3)',
        }}
      >
        <span>30m</span>
        <span>24h</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [data, setData] = useState<OnboardingData>({
    display_name: '',
    timezone: '',
    wake_time: '07:00',
    sleep_time: '23:30',
    peak_start: '09:00',
    peak_end: '12:00',
    morning_prep_mins: 30,
    lunch_window_start: '12:00',
    dinner_window_start: '19:00',
    wind_down_mins: 30,
    courses: [{ name: '', code: '', color: 'var(--amber)', difficulty: 3 }],
    commitments: [],
    session_mode: '90_20',
    canvas_domain: 'canvas.cmu.edu',
    canvas_api_token: '',
  })

  const update = (patch: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...patch }))

  // Pre-fill from Google session, detect timezone, and skip if already onboarded
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    update({ timezone: tz })

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const meta = user.user_metadata ?? {}
      const name: string =
        meta.full_name ?? meta.name ?? meta.email?.split('@')[0] ?? ''
      if (name) update({ display_name: name })

      // If they're already onboarded in the DB (e.g. cookie was cleared),
      // re-stamp the cookie and send them home — no need to repeat onboarding.
      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single()
      if (profile?.onboarding_complete) {
        const secure =
          window.location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `apex_onboarded=true; path=/; max-age=31536000; SameSite=Lax${secure}`
        router.push('/home')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers for courses list
  const addCourse = () =>
    update({
      courses: [
        ...data.courses,
        {
          name: '',
          code: '',
          color: COURSE_COLORS[data.courses.length % COURSE_COLORS.length],
          difficulty: 3,
        },
      ],
    })

  const patchCourse = (i: number, patch: Partial<CourseInput>) =>
    update({
      courses: data.courses.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    })

  const removeCourse = (i: number) =>
    update({ courses: data.courses.filter((_, idx) => idx !== i) })

  const defaultCommitment = (): CommitmentInput => ({
    name: '',
    days_per_week: 3,
    duration_stop_index: nearestStopIndex(1.25),
  })

  const addCommitment = () =>
    update({ commitments: [...data.commitments, defaultCommitment()] })

  const patchCommitment = (i: number, patch: Partial<CommitmentInput>) =>
    update({
      commitments: data.commitments.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    })

  const removeCommitment = (i: number) =>
    update({ commitments: data.commitments.filter((_, idx) => idx !== i) })

  const commitmentDurationMins = (c: CommitmentInput) =>
    Math.round(hoursFromStopIndex(c.duration_stop_index) * 60)

  // Sleep duration helper
  const sleepHours = () => {
    const [wh, wm] = data.wake_time.split(':').map(Number)
    const [sh, sm] = data.sleep_time.split(':').map(Number)
    const wake = wh * 60 + wm
    const sleep = sh * 60 + sm
    const diff = (wake - sleep + 24 * 60) % (24 * 60)
    const h = Math.floor(diff / 60)
    const m = diff % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }

  // Finish and save
  const handleFinish = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expired — please sign in again.')

      const { data: existingProfile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single()
      if (existingProfile?.onboarding_complete) {
        router.push('/home')
        return
      }

      const { data: existingCourses } = await supabase
        .from('courses')
        .select('name, code')
        .eq('user_id', user.id)
        .eq('is_active', true)
      const existingKeys = new Set(
        (existingCourses ?? []).map((c) =>
          `${c.name.trim().toLowerCase()}|${(c.code ?? '').trim().toLowerCase()}`,
        ),
      )

      // Update user profile
      const { error: profileErr } = await supabase
        .from('users')
        .update({
          display_name: data.display_name.trim() || null,
          timezone: data.timezone,
          session_mode: data.session_mode,
          onboarding_complete: true,
        })
        .eq('id', user.id)
      if (profileErr) throw new Error(profileErr.message)

      // Save preferences
      const { error: prefErr } = await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          wake_time_default: data.wake_time,
          sleep_time_default: data.sleep_time,
          entrepreneur_daily_hours: 0,
          cmr_daily_hours: 0,
          session_mode: data.session_mode,
          lunch_window_start: data.lunch_window_start,
          lunch_window_end: '15:00',
          lunch_duration_mins: 45,
          dinner_window_start: data.dinner_window_start,
          dinner_window_end: '23:00',
          dinner_duration_mins: 60,
          shower_mins: data.morning_prep_mins,
          skincare_mins: data.wind_down_mins,
          sleep_buffer_hours: 8.5,
          peak_start: data.peak_start,
          peak_end: data.peak_end,
        },
        { onConflict: 'user_id' },
      )
      if (prefErr) throw new Error(prefErr.message)

      // Save courses — skip rows that already exist (guards double-submit / re-runs)
      const valid = data.courses.filter((c) => c.name.trim())
      for (const c of valid) {
        const key = `${c.name.trim().toLowerCase()}|${c.code.trim().toLowerCase()}`
        if (existingKeys.has(key)) continue
        const { error: cErr } = await supabase.from('courses').insert({
          user_id: user.id,
          name: c.name.trim(),
          code: c.code.trim() || null,
          color: c.color,
          is_active: true,
          canvas_course_id: null,
        })
        if (cErr) throw new Error(`Failed to save "${c.name}": ${cErr.message}`)
        existingKeys.add(key)
      }

      // Save recurring commitments as habits (full fields when v1 migration is applied)
      const validCommitments = data.commitments.filter(
        (c) => c.name.trim() && c.days_per_week > 0,
      )
      for (let i = 0; i < validCommitments.length; i++) {
        const c = validCommitments[i]
        const durationMins = commitmentDurationMins(c)
        const isDaily = c.days_per_week >= 7
        const base = {
          user_id: user.id,
          name: c.name.trim(),
          icon: '⚡',
          color: COURSE_COLORS[i % COURSE_COLORS.length],
          target_frequency: (isDaily ? 'daily' : 'custom') as Habit['target_frequency'],
          is_active: true,
          sort_order: i,
        }
        const v1 = {
          mode: 'time_blocked' as const,
          duration_mins: durationMins,
          frequency_type: (isDaily ? 'daily' : 'per_week') as Habit['frequency_type'],
          frequency_target: isDaily ? 1 : c.days_per_week,
          cognitive_class: 'creative',
        }

        let { error: hErr } = await supabase.from('habits').insert({ ...base, ...v1 })
        if (hErr?.message?.includes('column')) {
          ;({ error: hErr } = await supabase.from('habits').insert(base))
        }
        if (hErr) throw new Error(`Failed to save "${c.name}": ${hErr.message}`)
      }

      // Save Canvas token if provided
      if (data.canvas_api_token.trim()) {
        const { error: canvasErr } = await supabase
          .from('users')
          .update({
            canvas_domain: data.canvas_domain,
            canvas_api_token: data.canvas_api_token.trim(),
          })
          .eq('id', user.id)
        if (canvasErr) throw new Error(canvasErr.message)
      }

      const secure =
        typeof window !== 'undefined' && window.location.protocol === 'https:'
          ? '; Secure'
          : ''
      document.cookie = `apex_onboarded=true; path=/; max-age=31536000; SameSite=Lax${secure}`
      router.push('/home')
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Something went wrong.',
      )
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const isLast = step === STEPS.length - 1

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px 40px',
        fontFamily: 'var(--font-head)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="apex-ambient" aria-hidden />
      {/* Brand */}
      <div style={{ marginBottom: 28, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: 'var(--text)',
            letterSpacing: '-.05em',
            marginBottom: 4,
            fontFamily: 'var(--font-head)',
          }}
        >
          <span style={{ color: 'var(--amber)' }}>A</span>PEX
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text3)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
          }}
        >
          {STEPS[step].label}
        </div>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 24, position: 'relative', zIndex: 1 }}>
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            style={{
              width: i === step ? 20 : 5,
              height: 5,
              borderRadius: 3,
              background: i < step ? 'var(--amber)' : i === step ? 'var(--amber)' : 'var(--bg4)',
              opacity: i < step ? 0.45 : 1,
              transition: 'width .3s ease, background .2s',
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'linear-gradient(180deg, var(--surface), var(--bg2))',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '28px 28px 24px',
          boxShadow: '0 1px 0 var(--border-lit) inset, 0 8px 40px rgba(0,0,0,.45)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 6,
                  letterSpacing: '-.02em',
                }}
              >
                {data.display_name
                  ? `Welcome, ${data.display_name.split(' ')[0]}.`
                  : 'Welcome to APEX.'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                Let&apos;s take 2 minutes to personalise your plan engine. Everything can be changed later in Settings.
              </p>
            </div>

            <Field label="Your name">
              <input
                style={input}
                placeholder="e.g. Alex"
                value={data.display_name}
                onChange={(e) => update({ display_name: e.target.value })}
              />
            </Field>

            <Field label="Your timezone">
              <input
                style={input}
                value={data.timezone}
                onChange={(e) => update({ timezone: e.target.value })}
                placeholder="America/New_York"
              />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text3)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: 5,
                }}
              >
                Auto-detected from your browser — edit if wrong.
              </div>
            </Field>
          </div>
        )}

        {/* ── Step 1: Schedule ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 6,
                  letterSpacing: '-.02em',
                }}
              >
                Your day
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                APEX anchors your schedule around these times to place tasks, protect breaks, and compute free hours.
              </p>
            </div>

            <div style={fieldset(2)}>
              <Field label="Wake time">
                <input
                  type="time"
                  style={input}
                  value={data.wake_time}
                  onChange={(e) => update({ wake_time: e.target.value })}
                />
              </Field>
              <Field label="Bedtime">
                <input
                  type="time"
                  style={input}
                  value={data.sleep_time}
                  onChange={(e) => update({ sleep_time: e.target.value })}
                />
              </Field>
            </div>

            <div
              style={{
                padding: '10px 14px',
                background: 'var(--bg3)',
                borderRadius: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text2)',
              }}
            >
              Sleep target:{' '}
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                {sleepHours()}
              </span>{' '}
              · Adjust times until this feels right.
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text3)',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '.07em',
                  marginBottom: 10,
                }}
              >
                Peak cognitive window
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text2)',
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                When are you sharpest? APEX schedules your hardest work here.
              </p>
              <div style={fieldset(2)}>
                <Field label="Starts">
                  <input
                    type="time"
                    style={input}
                    value={data.peak_start}
                    onChange={(e) => update({ peak_start: e.target.value })}
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="time"
                    style={input}
                    value={data.peak_end}
                    onChange={(e) => update({ peak_end: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Routines ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 6,
                  letterSpacing: '-.02em',
                }}
              >
                Your routines
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                These blocks are auto-protected in your daily plan — APEX won&apos;t schedule tasks during them.
              </p>
            </div>

            <RangeRow
              label="Morning prep"
              value={data.morning_prep_mins}
              min={10}
              max={90}
              step={5}
              fmt={(v) => `${v} min`}
              onChange={(v) => update({ morning_prep_mins: v })}
            />
            <div
              style={{
                fontSize: 11,
                color: 'var(--text3)',
                fontFamily: 'var(--font-mono)',
                marginTop: -10,
              }}
            >
              Getting ready, breakfast, anything before your first task.
            </div>

            <RangeRow
              label="Evening wind-down"
              value={data.wind_down_mins}
              min={10}
              max={90}
              step={5}
              fmt={(v) => `${v} min`}
              onChange={(v) => update({ wind_down_mins: v })}
            />
            <div
              style={{
                fontSize: 11,
                color: 'var(--text3)',
                fontFamily: 'var(--font-mono)',
                marginTop: -10,
              }}
            >
              Reading, journaling, unwinding — whatever helps you decompress before sleep.
            </div>

            <div style={fieldset(2)}>
              <Field label="Lunch around">
                <input
                  type="time"
                  style={input}
                  value={data.lunch_window_start}
                  onChange={(e) => update({ lunch_window_start: e.target.value })}
                />
              </Field>
              <Field label="Dinner around">
                <input
                  type="time"
                  style={input}
                  value={data.dinner_window_start}
                  onChange={(e) =>
                    update({ dinner_window_start: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 3: Courses ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 6,
                  letterSpacing: '-.02em',
                }}
              >
                Courses & projects
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                APEX groups tasks by course and uses difficulty to weight effort estimates.
              </p>
            </div>

            {data.courses.map((course, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ flex: 2 }}>
                  {i === 0 && <Label>Course / project</Label>}
                  <input
                    style={input}
                    placeholder="e.g. Computer Systems"
                    value={course.name}
                    onChange={(e) => patchCourse(i, { name: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  {i === 0 && <Label>Code</Label>}
                  <input
                    style={input}
                    placeholder="18-213"
                    value={course.code}
                    onChange={(e) => patchCourse(i, { code: e.target.value })}
                  />
                </div>
                <div
                  onClick={() => {
                    const next =
                      COURSE_COLORS[
                        (COURSE_COLORS.indexOf(course.color) + 1) %
                          COURSE_COLORS.length
                      ]
                    patchCourse(i, { color: next })
                  }}
                  title="Click to change colour"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: course.color,
                    cursor: 'pointer',
                    flexShrink: 0,
                    border: '2px solid var(--border)',
                    marginBottom: 1,
                  }}
                />
                {data.courses.length > 1 && (
                  <button
                    onClick={() => removeCourse(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text3)',
                      cursor: 'pointer',
                      fontSize: 18,
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addCourse}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: '1px dashed var(--border2)',
                borderRadius: 8,
                color: 'var(--text3)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              + Add course
            </button>

            <div
              style={{
                fontSize: 11,
                color: 'var(--text3)',
                fontFamily: 'var(--font-mono)',
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
                lineHeight: 1.6,
              }}
            >
              You can skip this and add courses later in Settings → Courses.
            </div>
          </div>
        )}

        {/* ── Step 4: Commitments ── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 6,
                  letterSpacing: '-.02em',
                }}
              >
                Commitments & style
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                Recurring blocks APEX protects in your day — gym, side projects, clubs, anything you do on a schedule.
              </p>
            </div>

            {data.commitments.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text3)',
                  fontFamily: 'var(--font-mono)',
                  padding: '14px 16px',
                  background: 'var(--bg3)',
                  border: '1px dashed var(--border2)',
                  borderRadius: 10,
                  lineHeight: 1.6,
                }}
              >
                No commitments yet. Add anything you want blocked on your calendar — or skip and set them up later in Habits.
              </div>
            )}

            {data.commitments.map((commitment, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    {i === 0 && <Label>Commitment name</Label>}
                    <input
                      style={input}
                      placeholder="e.g. Gym, Startup, Reading"
                      value={commitment.name}
                      onChange={(e) => patchCommitment(i, { name: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={() => removeCommitment(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text3)',
                      cursor: 'pointer',
                      fontSize: 18,
                      padding: 2,
                      flexShrink: 0,
                    }}
                    aria-label="Remove commitment"
                  >
                    ×
                  </button>
                </div>

                <div style={fieldset(2)}>
                  <RangeRow
                    label="Days / week"
                    value={commitment.days_per_week}
                    min={1}
                    max={7}
                    fmt={(v) => (v >= 7 ? 'Daily' : `${v}×`)}
                    onChange={(v) => patchCommitment(i, { days_per_week: v })}
                  />
                  <LogRangeRow
                    label="Time per session"
                    stopIndex={commitment.duration_stop_index}
                    onChange={(idx) => patchCommitment(i, { duration_stop_index: idx })}
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addCommitment}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: '1px dashed var(--border2)',
                borderRadius: 8,
                color: 'var(--text3)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              + Add commitment
            </button>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <Label>Work session mode</Label>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text2)',
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}
              >
                How APEX chunks your study sessions.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['90_20', '50_10'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => update({ session_mode: m })}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      borderRadius: 10,
                      border: `1.5px solid ${data.session_mode === m ? 'var(--amber)' : 'var(--border2)'}`,
                      background:
                        data.session_mode === m
                          ? 'var(--amber-bg, rgba(251,191,36,.1))'
                          : 'var(--bg3)',
                      color:
                        data.session_mode === m
                          ? 'var(--amber)'
                          : 'var(--text3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'pre-line' as const,
                      textAlign: 'center',
                      lineHeight: 1.5,
                      transition: 'border-color .15s, background .15s, color .15s',
                    }}
                  >
                    {m === '90_20'
                      ? '90 min work\n20 min break'
                      : '50 min work\n10 min break'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Launch ── */}
        {step === 5 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--amber-bg, rgba(251,191,36,.1))',
                border: '1px solid rgba(251,191,36,.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
              }}
            >
              🎯
            </div>

            <div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 8,
                  letterSpacing: '-.02em',
                }}
              >
                {data.display_name
                  ? `You're ready, ${data.display_name.split(' ')[0]}.`
                  : "You're all set."}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text2)',
                  lineHeight: 1.7,
                  maxWidth: 320,
                }}
              >
                APEX will build your first daily plan using your schedule, courses, and commitments.
              </p>
            </div>

            {/* Optional Canvas token */}
            <div
              style={{
                width: '100%',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: 'var(--text)',
                }}
              >
                Canvas integration{' '}
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text3)',
                    fontWeight: 400,
                  }}
                >
                  optional
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text3)',
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}
              >
                Connect Canvas LMS to auto-import assignments and due dates.
              </p>
              <Label>Canvas domain</Label>
              <input
                style={{ ...input, marginBottom: 8 }}
                value={data.canvas_domain}
                onChange={(e) => update({ canvas_domain: e.target.value })}
              />
              <Label>API token</Label>
              <input
                style={{ ...input, fontFamily: 'monospace' }}
                type="password"
                placeholder="Paste your Canvas API token"
                value={data.canvas_api_token}
                onChange={(e) => update({ canvas_api_token: e.target.value })}
              />
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text3)',
                  fontFamily: 'var(--font-mono)',
                  marginTop: 6,
                }}
              >
                Settings → Integrations to add or change this later.
              </div>
            </div>

            <p
              style={{
                fontSize: 11,
                color: 'var(--text3)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              All of this can be edited in Settings at any time.
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {saveError && (
        <div
          style={{
            marginTop: 12,
            width: '100%',
            maxWidth: 440,
            padding: '10px 14px',
            background: 'rgba(240,106,106,.1)',
            border: '1px solid rgba(240,106,106,.4)',
            borderRadius: 10,
            color: '#f5b4b4',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {saveError}
        </div>
      )}

      {/* Nav buttons */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 18,
          width: '100%',
          maxWidth: 440,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text2)',
              fontFamily: 'var(--font-head)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all .2s var(--ease-out)',
            }}
          >
            ← Back
          </button>
        )}
        <button
          onClick={() => {
            if (!isLast) {
              setStep((s) => s + 1)
            } else {
              handleFinish()
            }
          }}
          disabled={saving}
          style={{
            flex: 2,
            padding: '12px 16px',
            background: 'linear-gradient(180deg, var(--amber), #e0941a)',
            border: 'none',
            borderRadius: 12,
            color: '#1a1206',
            fontFamily: 'var(--font-head)',
            fontSize: 14,
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            transition: 'opacity .15s',
          }}
        >
          {isLast
            ? saving
              ? 'Saving…'
              : "Let's go →"
            : step === 3
              ? 'Continue →'
              : 'Continue →'}
        </button>
      </div>

      {/* Skip hint for courses step */}
      {step === 3 && (
        <button
          onClick={() => setStep((s) => s + 1)}
          style={{
            marginTop: 12,
            background: 'none',
            border: 'none',
            color: 'var(--text3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'underline',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Skip for now
        </button>
      )}
    </div>
  )
}
