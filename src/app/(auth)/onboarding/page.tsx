'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STEPS = ['Courses', 'Commitments', 'Preferences', 'Your First Plan']

interface CourseInput {
  name: string
  code: string
  color: string
}

interface OnboardingData {
  courses: CourseInput[]
  canvas_domain: string
  canvas_api_token: string
  gym_duration: number
  entrepreneur_hours: number
  cmr_hours: number
  wake_time: string
  sleep_time: string
  session_mode: '90_20' | '50_10'
  lunch_window_start: string
  dinner_window_start: string
}

const COURSE_COLORS = [
  'var(--amber)',
  'var(--blue)',
  'var(--green)',
  'var(--pink)',
  'var(--purple)',
  'var(--red)',
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: 8,
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text3)',
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  display: 'block',
  marginBottom: 4,
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [data, setData] = useState<OnboardingData>({
    courses: [{ name: '', code: '', color: 'var(--amber)' }],
    canvas_domain: 'canvas.cmu.edu',
    canvas_api_token: '',
    gym_duration: 90,
    entrepreneur_hours: 3,
    cmr_hours: 3,
    wake_time: '08:00',
    sleep_time: '23:30',
    session_mode: '90_20',
    lunch_window_start: '12:00',
    dinner_window_start: '19:00',
  })

  const updateData = (patch: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...patch }))

  const addCourse = () =>
    updateData({
      courses: [
        ...data.courses,
        {
          name: '',
          code: '',
          color: COURSE_COLORS[data.courses.length % COURSE_COLORS.length],
        },
      ],
    })

  const updateCourse = (i: number, patch: Partial<CourseInput>) =>
    updateData({
      courses: data.courses.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    })

  const removeCourse = (i: number) =>
    updateData({ courses: data.courses.filter((_, idx) => idx !== i) })

  const handleFinish = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setSaveError('Session expired — please sign in again.')
        setSaving(false)
        return
      }

      const validCourses = data.courses.filter((c) => c.name.trim())
      for (const c of validCourses) {
        const { error } = await supabase.from('courses').insert({
          user_id: user.id,
          name: c.name.trim(),
          code: c.code.trim() || null,
          color: c.color,
          is_active: true,
          canvas_course_id: null,
        })
        if (error) throw new Error(`Failed to save course "${c.name}": ${error.message}`)
      }

      const { error: prefError } = await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          gym_duration_cascade: [
            data.gym_duration,
            Math.max(30, data.gym_duration - 30),
            30,
          ],
          entrepreneur_daily_hours: data.entrepreneur_hours,
          cmr_daily_hours: data.cmr_hours,
          wake_time_default: data.wake_time,
          sleep_time_default: data.sleep_time,
          session_mode: data.session_mode,
          lunch_window_start: data.lunch_window_start,
          lunch_window_end: '15:00',
          lunch_duration_mins: 45,
          dinner_window_start: data.dinner_window_start,
          dinner_window_end: '23:00',
          dinner_duration_mins: 60,
          shower_mins: 30,
          skincare_mins: 30,
          sleep_buffer_hours: 8.5,
        },
        { onConflict: 'user_id' },
      )
      if (prefError) throw new Error(`Failed to save preferences: ${prefError.message}`)

      if (data.canvas_api_token.trim()) {
        const { error: canvasError } = await supabase
          .from('users')
          .update({
            canvas_domain: data.canvas_domain,
            canvas_api_token: data.canvas_api_token.trim(),
          })
          .eq('id', user.id)
        if (canvasError) throw new Error(`Failed to save Canvas token: ${canvasError.message}`)
      }

      document.cookie =
        'apex_onboarded=true; path=/; max-age=31536000; SameSite=Lax'
      router.push('/home')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: 'var(--amber)',
            letterSpacing: '-.03em',
            marginBottom: 4,
          }}
        >
          APEX
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Let&apos;s set things up
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              width: i === step ? 24 : 6,
              height: 6,
              borderRadius: 3,
              background: i <= step ? 'var(--amber)' : 'var(--bg4)',
              transition: 'width .3s, background .2s',
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '24px 24px',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {STEPS[step]}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text3)',
            fontFamily: 'var(--font-mono)',
            marginBottom: 20,
          }}
        >
          Step {step + 1} of {STEPS.length}
        </div>

        {/* Step 1: Courses */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text2)',
                marginBottom: 4,
              }}
            >
              Add your courses. APEX will use these to group tasks and suggest
              effort estimates.
            </p>
            {data.courses.map((course, i) => (
              <div
                key={i}
                style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
              >
                <div style={{ flex: 2 }}>
                  {i === 0 && <label style={labelStyle}>Course name</label>}
                  <input
                    style={inputStyle}
                    placeholder="e.g. 15-213 Computer Systems"
                    value={course.name}
                    onChange={(e) => updateCourse(i, { name: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  {i === 0 && <label style={labelStyle}>Short code</label>}
                  <input
                    style={inputStyle}
                    placeholder="15-213"
                    value={course.code}
                    onChange={(e) => updateCourse(i, { code: e.target.value })}
                  />
                </div>
                <div
                  onClick={() => {
                    const nextColor =
                      COURSE_COLORS[
                        (COURSE_COLORS.indexOf(course.color) + 1) %
                          COURSE_COLORS.length
                      ]
                    updateCourse(i, { color: nextColor })
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: course.color,
                    cursor: 'pointer',
                    flexShrink: 0,
                    border: '2px solid var(--border)',
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
                      fontSize: 16,
                      padding: '4px',
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
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
                marginTop: 4,
              }}
            >
              <label style={labelStyle}>Canvas domain (optional)</label>
              <input
                style={inputStyle}
                value={data.canvas_domain}
                onChange={(e) => updateData({ canvas_domain: e.target.value })}
              />
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>Canvas API token (optional)</label>
                <input
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  type="password"
                  placeholder="Paste your Canvas API token"
                  value={data.canvas_api_token}
                  onChange={(e) =>
                    updateData({ canvas_api_token: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Commitments */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text2)',
                marginBottom: 4,
              }}
            >
              How much time do you want to protect each day for these?
            </p>
            {(
              [
                {
                  label: 'Gym',
                  key: 'gym_duration' as const,
                  unit: 'min',
                  min: 30,
                  max: 150,
                  step: 15,
                  value: data.gym_duration,
                },
                {
                  label: 'Entrepreneur work',
                  key: 'entrepreneur_hours' as const,
                  unit: 'h',
                  min: 0,
                  max: 8,
                  step: 0.5,
                  value: data.entrepreneur_hours,
                },
                {
                  label: 'CMR',
                  key: 'cmr_hours' as const,
                  unit: 'h',
                  min: 0,
                  max: 8,
                  step: 0.5,
                  value: data.cmr_hours,
                },
              ] as const
            ).map(({ label, key, unit, min, max, step: s, value }) => (
              <div key={key}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    {label}
                  </label>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--amber)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                    }}
                  >
                    {value}
                    {unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={s}
                  value={value}
                  onChange={(e) =>
                    updateData({ [key]: parseFloat(e.target.value) })
                  }
                  style={{ width: '100%', accentColor: 'var(--amber)' }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Preferences */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text2)',
                marginBottom: 4,
              }}
            >
              Set your daily schedule defaults. APEX will use these to build
              your plan.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Default wake time</label>
                <input
                  type="time"
                  style={inputStyle}
                  value={data.wake_time}
                  onChange={(e) => updateData({ wake_time: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Default sleep time</label>
                <input
                  type="time"
                  style={inputStyle}
                  value={data.sleep_time}
                  onChange={(e) => updateData({ sleep_time: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Lunch around</label>
                <input
                  type="time"
                  style={inputStyle}
                  value={data.lunch_window_start}
                  onChange={(e) =>
                    updateData({ lunch_window_start: e.target.value })
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>Dinner around</label>
                <input
                  type="time"
                  style={inputStyle}
                  value={data.dinner_window_start}
                  onChange={(e) =>
                    updateData({ dinner_window_start: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Work session mode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['90_20', '50_10'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => updateData({ session_mode: m })}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: 8,
                      border: `1px solid ${data.session_mode === m ? 'var(--amber)' : 'var(--border2)'}`,
                      background:
                        data.session_mode === m
                          ? 'var(--amber-bg)'
                          : 'var(--bg3)',
                      color:
                        data.session_mode === m
                          ? 'var(--amber)'
                          : 'var(--text3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      cursor: 'pointer',
                      whiteSpace: 'pre-line' as const,
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

        {/* Step 4: First plan */}
        {step === 3 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              textAlign: 'center',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--amber-bg)',
                border: '1px solid var(--amber-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              🎯
            </div>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text2)',
                lineHeight: 1.6,
              }}
            >
              You&apos;re all set. APEX will build your first daily plan using
              your courses, preferences, and any tasks you add.
            </p>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text3)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              You can change any of these settings later in the Settings tab.
            </p>
          </div>
        )}
      </div>

      {saveError && (
        <div
          style={{
            marginTop: 12,
            width: '100%',
            maxWidth: 400,
            padding: '10px 14px',
            background: 'var(--red-bg, #2a1414)',
            border: '1px solid var(--red, #f87171)',
            borderRadius: 8,
            color: 'var(--red, #f87171)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          {saveError}
        </div>
      )}

      {/* Navigation buttons */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 20,
          width: '100%',
          maxWidth: 400,
        }}
      >
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'var(--bg3)',
              border: '1px solid var(--border2)',
              borderRadius: 10,
              color: 'var(--text2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        )}
        <button
          onClick={() => {
            if (step < STEPS.length - 1) {
              setStep((s) => s + 1)
            } else {
              handleFinish()
            }
          }}
          disabled={saving}
          style={{
            flex: 2,
            padding: '10px 16px',
            background: 'var(--amber)',
            border: 'none',
            borderRadius: 10,
            color: '#000',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {step < STEPS.length - 1 ? 'Continue →' : saving ? 'Saving…' : "Let's go →"}
        </button>
      </div>
    </div>
  )
}
