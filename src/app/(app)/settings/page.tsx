'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

interface UserProfile {
  display_name: string | null
  canvas_domain: string | null
  canvas_api_token: string | null
  google_calendar_token: string | null
}

export default function SettingsPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | undefined>()
  const [profile, setProfile] = useState<UserProfile>({
    display_name: '',
    canvas_domain: 'canvas.cmu.edu',
    canvas_api_token: '',
    google_calendar_token: null,
  })
  const [prefs, setPrefs] = useState<Preferences>({
    wake_time_default: '08:00',
    sleep_time_default: '23:30',
    session_mode: '90_20',
    gym_duration_cascade: [90, 60, 30],
    entrepreneur_daily_hours: 3,
    cmr_daily_hours: 3,
    lunch_window_start: '12:00',
    dinner_window_start: '19:00',
    shower_mins: 30,
    skincare_mins: 30,
  })
  const [saved, setSaved] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        Promise.all([
          supabase
            .from('users')
            .select('display_name,canvas_domain,canvas_api_token,google_calendar_token')
            .eq('id', user.id)
            .single(),
          supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
        ]).then(([{ data: userData }, { data: prefsData }]) => {
          if (userData) setProfile(userData)
          if (prefsData) setPrefs((p) => ({ ...p, ...prefsData }))
        })
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const savePrefs = useCallback(
    (updatedPrefs: Preferences) => {
      if (!userId) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        await supabase
          .from('user_preferences')
          .upsert({ user_id: userId, ...updatedPrefs }, { onConflict: 'user_id' })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }, 500)
    },
    [userId, supabase],
  )

  const saveProfile = useCallback(
    (updatedProfile: Partial<UserProfile>) => {
      if (!userId) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        await supabase.from('users').update(updatedProfile).eq('id', userId)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }, 500)
    },
    [userId, supabase],
  )

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    savePrefs(updated)
  }

  const updateProfile = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    const updated = { ...profile, [key]: value }
    setProfile(updated)
    saveProfile({ [key]: value })
  }

  const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    background: 'var(--bg3)',
    border: '1px solid var(--border2)',
    borderRadius: 7,
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    fontSize: 10,
    color: 'var(--text3)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase' as const,
    letterSpacing: '.07em',
    display: 'block',
    marginBottom: 4,
  }

  const sectionStyle = {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '16px',
    marginBottom: 10,
  }

  const sectionTitle = {
    fontSize: 11,
    color: 'var(--text3)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase' as const,
    letterSpacing: '.08em',
    marginBottom: 14,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>Settings</span>
        {saved && (
          <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
            ✓ Saved
          </span>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px 24px',
          scrollbarWidth: 'none',
        }}
      >
        {/* Profile */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Profile</div>
          <label style={labelStyle}>Display name</label>
          <input
            style={inputStyle}
            value={profile.display_name ?? ''}
            onChange={(e) => updateProfile('display_name', e.target.value)}
            placeholder="Your name"
          />
        </div>

        {/* Integrations */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Integrations</div>

          <div
            style={{
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                Google Calendar
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: profile.google_calendar_token ? 'var(--green)' : 'var(--text3)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {profile.google_calendar_token ? 'Connected' : 'Not connected'}
              </div>
            </div>
            {!profile.google_calendar_token && (
              <button
                style={{
                  padding: '6px 14px',
                  background: 'var(--bg4)',
                  border: '1px solid var(--border2)',
                  borderRadius: 20,
                  color: 'var(--text2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Connect
              </button>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <label style={labelStyle}>Canvas domain</label>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              value={profile.canvas_domain ?? ''}
              onChange={(e) => updateProfile('canvas_domain', e.target.value)}
              placeholder="canvas.cmu.edu"
            />
            <label style={labelStyle}>Canvas API token</label>
            <input
              style={{ ...inputStyle, fontFamily: 'monospace' }}
              type="password"
              value={profile.canvas_api_token ?? ''}
              onChange={(e) => updateProfile('canvas_api_token', e.target.value)}
              placeholder="Paste your API token"
            />
          </div>
        </div>

        {/* Schedule defaults */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Schedule defaults</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label style={labelStyle}>Wake time</label>
              <input
                type="time"
                style={inputStyle}
                value={prefs.wake_time_default}
                onChange={(e) => updatePref('wake_time_default', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Sleep time</label>
              <input
                type="time"
                style={inputStyle}
                value={prefs.sleep_time_default}
                onChange={(e) => updatePref('sleep_time_default', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Lunch around</label>
              <input
                type="time"
                style={inputStyle}
                value={prefs.lunch_window_start}
                onChange={(e) => updatePref('lunch_window_start', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Dinner around</label>
              <input
                type="time"
                style={inputStyle}
                value={prefs.dinner_window_start}
                onChange={(e) => updatePref('dinner_window_start', e.target.value)}
              />
            </div>
          </div>

          <label style={labelStyle}>Session mode</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['90_20', '50_10'] as const).map((m) => (
              <button
                key={m}
                onClick={() => updatePref('session_mode', m)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: 8,
                  border: `1px solid ${prefs.session_mode === m ? 'var(--amber)' : 'var(--border2)'}`,
                  background: prefs.session_mode === m ? 'var(--amber-bg)' : 'var(--bg3)',
                  color: prefs.session_mode === m ? 'var(--amber)' : 'var(--text3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {m === '90_20' ? '90/20 Deep work' : '50/10 Lighter'}
              </button>
            ))}
          </div>

          {[
            {
              label: 'Gym duration',
              unit: 'min',
              getValue: () => prefs.gym_duration_cascade[0],
              setValue: (v: number) =>
                updatePref('gym_duration_cascade', [v, Math.max(30, v - 30), 30]),
              min: 30,
              max: 150,
              step: 15,
            },
            {
              label: 'Entrepreneur hours/day',
              unit: 'h',
              getValue: () => prefs.entrepreneur_daily_hours,
              setValue: (v: number) => updatePref('entrepreneur_daily_hours', v),
              min: 0,
              max: 8,
              step: 0.5,
            },
            {
              label: 'CMR hours/day',
              unit: 'h',
              getValue: () => prefs.cmr_daily_hours,
              setValue: (v: number) => updatePref('cmr_daily_hours', v),
              min: 0,
              max: 8,
              step: 0.5,
            },
          ].map(({ label, unit, getValue, setValue, min, max, step }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
                <span
                  style={{ fontSize: 12, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}
                >
                  {getValue()}
                  {unit}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={getValue()}
                onChange={(e) => setValue(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--amber)' }}
              />
            </div>
          ))}
        </div>

        {/* Data */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Data</div>
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: '1px solid rgba(240,106,106,.3)',
                borderRadius: 8,
                color: 'var(--red)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Clear all APEX data
            </button>
          ) : (
            <div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--red)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 10,
                }}
              >
                This will delete all your tasks, notes, plans, and habits. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'var(--bg4)',
                    border: '1px solid var(--border2)',
                    borderRadius: 8,
                    color: 'var(--text2)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'rgba(240,106,106,.15)',
                    border: '1px solid rgba(240,106,106,.3)',
                    borderRadius: 8,
                    color: 'var(--red)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Delete everything
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
