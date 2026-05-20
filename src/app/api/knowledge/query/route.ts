// src/app/api/knowledge/query/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { KNOWLEDGE_QUERY_PROMPT } from '@/lib/ai/prompts'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { query } = await request.json()

  // Text-based search (fallback without embeddings)
  // When pgvector embeddings are set up, replace with vector similarity search
  const { data: results } = await supabase
    .from('knowledge_bank')
    .select('content, source_type, metadata, created_at')
    .eq('user_id', user.id)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(10)

  const context = (results ?? []).map((r) => `[${r.source_type}] ${r.content}`).join('\n\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const promptTemplate = typeof KNOWLEDGE_QUERY_PROMPT === 'string'
    ? KNOWLEDGE_QUERY_PROMPT
    : 'Answer the user question using only the provided context. Be concise.'

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: promptTemplate.replace('{context}', context || 'No relevant data found.'),
    messages: [{ role: 'user', content: query }],
  })

  const answer = response.content[0].type === 'text' ? response.content[0].text : 'No answer found.'

  return Response.json({ answer, sources: results?.length ?? 0 })
}
