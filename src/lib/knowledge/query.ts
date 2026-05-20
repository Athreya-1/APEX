import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { KNOWLEDGE_QUERY_PROMPT } from '@/lib/ai/prompts'

export interface QueryResult {
  answer: string
  sources: number
}

export async function queryKnowledge(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<QueryResult> {
  // Text-based search fallback (pgvector cosine search requires embeddings infrastructure)
  // When embeddings are available, replace with: .order('embedding <=> $embedding')
  const { data: results } = await supabase
    .from('knowledge_bank')
    .select('content, source_type, metadata, created_at')
    .eq('user_id', userId)
    .ilike('content', `%${query.slice(0, 50)}%`)
    .order('created_at', { ascending: false })
    .limit(10)

  const context = (results ?? []).map((r: { source_type: string; content: string }) => `[${r.source_type}] ${r.content}`).join('\n\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const systemPrompt =
    typeof KNOWLEDGE_QUERY_PROMPT === 'string'
      ? KNOWLEDGE_QUERY_PROMPT.replace('{context}', context || 'No relevant data found.')
      : `Answer the question using context: ${context || 'No data found.'}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }],
  })

  const answer =
    response.content[0].type === 'text' ? response.content[0].text : 'No answer found.'
  return { answer, sources: results?.length ?? 0 }
}
