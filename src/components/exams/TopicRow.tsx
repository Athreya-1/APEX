'use client'
import type { ExamTopic } from '@/types'

interface TopicRowProps {
  topic: ExamTopic
  onConfidenceChange?: (topicId: string, level: number) => void
}

export function TopicRow({ topic, onConfidenceChange }: TopicRowProps) {
  const isDone = topic.status === 'done'
  const confidenceColors = ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--amber)', 'var(--green)']

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 0', borderBottom: '1px solid var(--border)',
      opacity: isDone ? 0.5 : 1,
    }}>
      {/* Status indicator */}
      <div style={{
        width: 14, height: 14, borderRadius: 4, flexShrink: 0,
        background: isDone ? 'var(--green)' : topic.status === 'in_progress' ? 'var(--amber-bg)' : 'var(--bg4)',
        border: `1px solid ${isDone ? 'var(--green)' : topic.status === 'in_progress' ? 'var(--amber-dim)' : 'var(--border2)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isDone && <span style={{ fontSize: 9, color: '#000' }}>✓</span>}
      </div>

      {/* Topic name */}
      <div style={{
        flex: 1, fontSize: 12, lineHeight: 1.4,
        color: isDone ? 'var(--text3)' : 'var(--text)',
        textDecoration: isDone ? 'line-through' : 'none',
      }}>
        {topic.topic_name}
      </div>

      {/* Confidence dots */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            onClick={() => onConfidenceChange?.(topic.id, level)}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: (topic.confidence_level ?? 0) >= level
                ? confidenceColors[level - 1]
                : 'var(--bg4)',
              cursor: onConfidenceChange ? 'pointer' : 'default',
              transition: 'background .15s',
            }}
          />
        ))}
      </div>

      {/* Estimate */}
      {topic.estimated_hours != null && (
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)', flexShrink: 0 }}>
          {topic.estimated_hours}h
        </span>
      )}
    </div>
  )
}
