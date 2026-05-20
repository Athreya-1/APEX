/**
 * @jest-environment node
 */

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            intent: 'add_task',
            confidence: 0.95,
            parsed: {
              tasks: [{
                task_name: 'Lab 4',
                topic: '15-213',
                task_type_tag: 'lab',
                due_date: null,
                do_date: null,
                estimated_hours: null,
                description: null,
                eisenhower_quadrant: 'urgent_important',
              }],
            },
            clarification_needed: null,
          }),
        }],
      }),
    },
  })),
}))

// Mock Supabase server client
const mockSingle = jest.fn().mockResolvedValue({
  data: { id: 'task-1', task_name: 'Lab 4', user_id: 'user-123' },
  error: null,
})
const mockSelect = jest.fn().mockReturnThis()
const mockInsert = jest.fn().mockReturnValue({ select: mockSelect })
const mockLimit = jest.fn().mockResolvedValue({ data: [] })
const mockNeq = jest.fn().mockReturnThis()
const mockIlike = jest.fn().mockReturnValue({ limit: mockLimit })
const mockEq = jest.fn().mockReturnThis()
const mockUpdate = jest.fn().mockReturnThis()
const mockFrom = jest.fn().mockReturnValue({
  insert: mockInsert,
  select: mockSelect,
  eq: mockEq,
  limit: mockLimit,
  ilike: mockIlike,
  update: mockUpdate,
  neq: mockNeq,
  single: mockSingle,
})

// Attach single to select's return value
mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq, limit: mockLimit })

const mockSupabase = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
    }),
  },
  from: mockFrom,
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue(mockSupabase),
}))

describe('POST /api/ai', () => {
  it('returns 401 when not authenticated', async () => {
    const { createClient } = require('@/lib/supabase/server')
    ;(createClient as jest.Mock).mockResolvedValueOnce({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    })
    const { POST } = await import('@/app/api/ai/route')
    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      body: JSON.stringify({ input: 'test', context: {} }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('classifies add_task intent and returns structured response', async () => {
    const { POST } = await import('@/app/api/ai/route')
    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      body: JSON.stringify({
        input: 'Add 15-213 Lab 4 due Friday',
        context: { user_name: 'Athreya', courses: [], notepads: [], habits: [], recent_tasks: [] },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('add_task')
  })
})
