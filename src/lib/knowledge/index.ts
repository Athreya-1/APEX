// src/lib/knowledge/index.ts
import type { KnowledgeSourceType } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

interface IndexOptions {
  supabase: SupabaseClient
  user_id: string
  content: string
  source_type: KnowledgeSourceType
  source_id: string
  metadata?: Record<string, unknown>
}

/**
 * Index content in the knowledge bank.
 * Note: embedding generation is deferred — content is stored and
 * embeddings can be generated in a background job.
 */
export async function indexKnowledge(options: IndexOptions): Promise<void> {
  const { supabase, user_id, content, source_type, source_id, metadata } = options

  // Check if this source_id already exists
  const { data: existing } = await supabase
    .from('knowledge_bank')
    .select('id')
    .eq('user_id', user_id)
    .eq('source_type', source_type)
    .eq('source_id', source_id)
    .single()

  if (existing) {
    // Update existing entry
    await supabase
      .from('knowledge_bank')
      .update({ content, metadata: metadata ?? null })
      .eq('id', existing.id)
  } else {
    // Insert new entry (embedding will be null until background job runs)
    await supabase.from('knowledge_bank').insert({
      user_id,
      content,
      source_type,
      source_id,
      metadata: metadata ?? null,
    })
  }
}

/**
 * Index a completed task in the knowledge bank.
 */
export async function indexTask(
  supabase: SupabaseClient,
  userId: string,
  task: { id: string; task_name: string; topic: string; task_type_tag: string | null; due_date: string | null; description: string | null },
): Promise<void> {
  const content = [
    task.task_name,
    task.topic,
    task.task_type_tag,
    task.due_date ? `due ${task.due_date}` : null,
    task.description,
  ].filter(Boolean).join(' · ')

  await indexKnowledge({
    supabase,
    user_id: userId,
    content,
    source_type: 'task',
    source_id: task.id,
    metadata: { topic: task.topic, task_type_tag: task.task_type_tag, due_date: task.due_date },
  })
}

/**
 * Index a note in the knowledge bank.
 */
export async function indexNote(
  supabase: SupabaseClient,
  userId: string,
  note: { id: string; content: string; notepad_id: string },
  padName?: string,
): Promise<void> {
  await indexKnowledge({
    supabase,
    user_id: userId,
    content: padName ? `[${padName}] ${note.content}` : note.content,
    source_type: 'note',
    source_id: note.id,
    metadata: { notepad_id: note.notepad_id, pad_name: padName },
  })
}
