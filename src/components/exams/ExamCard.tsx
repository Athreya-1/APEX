'use client'
import { format, differenceInDays } from 'date-fns'
import { TopicRow } from './TopicRow'
import type { ExamPlan, ExamTopic } from '@/types'

interface ExamCardProps {
  exam: ExamPlan
  topics: ExamTopic[]
  onConfidenceChange?: (topicId: string, level: number) => void
}

export function ExamCard({ exam, topics, onConfidenceChange }: ExamCardProps) {
  const daysUntil = differenceInDays(new Date(exam.exam_date), new Date())
  const doneTopics = topics.filter((t) => t.status === 'done').length
  const progress = topics.length ? Math.round((doneTopics / topics.length) * 100) : 0

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 10,
    }}>
      {/* Progress bar across top */}
      <div style={{ height: 3, background: 'var(--bg4)' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--amber)', transition: 'width .3s' }} />
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.01em' }}>{exam.exam_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {format(new Date(exam.exam_date), 'MMM d, yyyy')}
            </div>
          </div>
          <div style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 20,
            background: daysUntil <= 3 ? 'rgba(240,106,106,.15)' : daysUntil <= 7 ? 'var(--amber-bg)' : 'var(--bg3)',
            color: daysUntil <= 3 ? 'var(--red)' : daysUntil <= 7 ? 'var(--amber)' : 'var(--text3)',
            border: `1px solid ${daysUntil <= 3 ? 'rgba(240,106,106,.3)' : daysUntil <= 7 ? 'var(--amber-dim)' : 'var(--border2)'}`,
          }}>
            In {daysUntil} days
          </div>
        </div>

        {/* Topics */}
        <div>
          {topics.slice(0, 5).map((topic) => (
            <TopicRow key={topic.id} topic={topic} onConfidenceChange={onConfidenceChange} />
          ))}
          {topics.length > 5 && (
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', paddingTop: 6 }}>
              +{topics.length - 5} more topics
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
