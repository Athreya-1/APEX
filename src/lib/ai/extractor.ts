import Anthropic from '@anthropic-ai/sdk'
import { SCREENSHOT_EXTRACTION_PROMPT } from '@/lib/ai/prompts'
import type { TaskTypeTag } from '@/types'

export interface ExtractedAssignment {
  task_name: string
  course_name: string | null
  due_date: string | null
  points: number | null
  description: string | null
  task_type_tag: TaskTypeTag
}

export interface ExtractionResult {
  assignments: ExtractedAssignment[]
  confidence: number
  notes: string
}

export async function extractFromScreenshot(
  base64Image: string,
  mimeType = 'image/png',
): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SCREENSHOT_EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
              data: base64Image,
            },
          },
          { type: 'text', text: 'Extract all assignments from this screenshot.' },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const parsed = JSON.parse(text)
    return {
      assignments: parsed.assignments ?? [],
      confidence: parsed.confidence ?? 0,
      notes: parsed.notes ?? '',
    }
  } catch {
    return { assignments: [], confidence: 0, notes: 'Failed to parse extraction result' }
  }
}
