'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExamCard } from '@/components/exams/ExamCard'
import { UniversalInput } from '@/components/input/UniversalInput'
import type { ExamPlan, ExamTopic } from '@/types'

export default function ExamsPage() {
  const supabase = createClient()
  const [exams, setExams] = useState<ExamPlan[]>([])
  const [topics, setTopics] = useState<ExamTopic[]>([])
  const [userId, setUserId] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
  }, [])

  useEffect(() => {
    if (!userId) return
    supabase.from('exam_plans').select('*').eq('user_id', userId).neq('status', 'done').order('exam_date')
      .then(({ data: examData }) => {
        if (examData) {
          setExams(examData)
          const ids = examData.map((e: ExamPlan) => e.id)
          if (ids.length) {
            supabase.from('exam_topics').select('*').in('exam_plan_id', ids).order('sort_order')
              .then(({ data }) => { if (data) setTopics(data) })
          }
        }
      })
  }, [userId])

  const handleConfidence = async (topicId: string, level: number) => {
    await supabase.from('exam_topics').update({ confidence_level: level }).eq('id', topicId)
    setTopics((prev) => prev.map((t) => t.id === topicId ? { ...t, confidence_level: level } : t))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>Exam Plans</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', scrollbarWidth: 'none' }}>
        {exams.map((exam) => (
          <ExamCard
            key={exam.id}
            exam={exam}
            topics={topics.filter((t) => t.exam_plan_id === exam.id)}
            onConfidenceChange={handleConfidence}
          />
        ))}
        <div style={{
          border: '1px dashed var(--border2)', borderRadius: 12, padding: '16px',
          textAlign: 'center', cursor: 'pointer', color: 'var(--text3)',
          fontSize: 12, fontFamily: 'var(--font-mono)',
        }}>
          + New exam plan
        </div>
      </div>

      <div style={{ padding: '8px 16px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <UniversalInput placeholder="Add an exam, screenshot topics, or ask about your study plan…" onSubmit={async () => {}} />
      </div>
    </div>
  )
}
