'use client'
import { useEffect, useRef } from 'react'
import { useVoice } from '@/hooks/useVoice'

const breathStyles = `
@keyframes apex-breath {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}
@keyframes apex-bar {
  0%, 100% { height: 6px; }
  50% { height: 22px; }
}
@keyframes apex-pulse {
  0%, 100% { box-shadow: 0 0 0 0px rgba(245,166,35,0.4); }
  50% { box-shadow: 0 0 0 10px rgba(245,166,35,0); }
}
`

interface VoiceOrbProps {
  mode: 'full' | 'mini'
  onSubmit: (text: string) => void
  onClose?: () => void
  /** For mini mode: whether the parent input has focus/glow */
  active?: boolean
}

export function VoiceOrb({ mode, onSubmit, onClose }: VoiceOrbProps) {
  const { isListening, transcript, interimTranscript, startListening, stopListening, isSupported } = useVoice()
  const styleInjectedRef = useRef(false)

  useEffect(() => {
    if (!styleInjectedRef.current && typeof document !== 'undefined') {
      const style = document.createElement('style')
      style.textContent = breathStyles
      document.head.appendChild(style)
      styleInjectedRef.current = true
    }
  }, [])

  // Auto-start on mount for full mode
  useEffect(() => {
    if (mode === 'full' && isSupported) {
      startListening()
    }
    return () => { stopListening() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const handleConfirm = () => {
    stopListening()
    if (transcript.trim()) {
      onSubmit(transcript.trim())
    }
    onClose?.()
  }

  const handleToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  if (mode === 'mini') {
    return (
      <div
        onClick={handleToggle}
        style={{
          position: 'absolute',
          bottom: 80,
          right: 16,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: isListening ? 'var(--amber)' : 'rgba(245,166,35,0.15)',
          border: '1px solid var(--amber-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          animation: isListening ? 'apex-pulse 1.5s ease-in-out infinite' : 'none',
          transition: 'background .2s',
        }}
      >
        {/* Mic SVG */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isListening ? '#000' : 'var(--amber)'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
        </svg>

        {/* Transcript card */}
        {isListening && (transcript || interimTranscript) && (
          <div style={{
            position: 'absolute',
            bottom: '120%',
            right: 0,
            minWidth: 200,
            maxWidth: 280,
            background: 'var(--bg3)',
            border: '1px solid var(--amber-dim)',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
            pointerEvents: 'none',
          }}>
            {transcript}
            <span style={{ color: 'var(--text3)' }}>{interimTranscript}</span>
          </div>
        )}
      </div>
    )
  }

  // Full screen mode
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      {/* Concentric rings */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 200, height: 200 }}>
        {[160, 120, 90].map((size, i) => (
          <div
            key={size}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: '50%',
              border: `1px solid rgba(245,166,35,${0.15 - i * 0.04})`,
              background: `rgba(245,166,35,${0.03 - i * 0.01})`,
              animation: isListening ? `apex-breath 2.4s ease-in-out infinite` : 'none',
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}

        {/* Central amber orb */}
        <div
          onClick={handleToggle}
          style={{
            position: 'relative',
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #ffc94d, var(--amber) 60%, #c47a0a)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            boxShadow: isListening ? '0 0 30px rgba(245,166,35,0.5)' : 'none',
            transition: 'box-shadow .3s',
          }}
        >
          {/* Waveform bars */}
          {[0, 0.2, 0.4, 0.2, 0].map((delay, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: isListening ? 16 : 8,
                background: '#000',
                borderRadius: 2,
                animation: isListening ? `apex-bar 0.8s ease-in-out infinite` : 'none',
                animationDelay: `${delay}s`,
                transition: 'height .3s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div style={{ maxWidth: 300, textAlign: 'center', minHeight: 44 }}>
        {transcript && (
          <p style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{transcript}</p>
        )}
        {interimTranscript && (
          <p style={{ fontSize: 16, color: 'var(--text3)', lineHeight: 1.6, margin: 0, marginTop: transcript ? 4 : 0 }}>
            {interimTranscript}
          </p>
        )}
        {!transcript && !interimTranscript && (
          <p style={{ fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--font-mono)', margin: 0 }}>
            {isListening ? 'Listening…' : 'Tap the orb to start'}
          </p>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => { stopListening(); onClose?.() }}
          style={{
            padding: '8px 20px',
            background: 'var(--bg4)',
            border: '1px solid var(--border2)',
            borderRadius: 20,
            color: 'var(--text2)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={!transcript.trim()}
          style={{
            padding: '8px 20px',
            background: transcript.trim() ? 'var(--amber)' : 'var(--bg4)',
            border: 'none',
            borderRadius: 20,
            color: transcript.trim() ? '#000' : 'var(--text3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            cursor: transcript.trim() ? 'pointer' : 'default',
            transition: 'background .2s, color .2s',
          }}
        >
          Confirm ↑
        </button>
      </div>
    </div>
  )
}
