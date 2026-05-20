/** @jest-environment node */
import { indexTask, indexNote } from '@/lib/knowledge/index'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  update: jest.fn().mockReturnThis(),
} as any

describe('knowledge indexing', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls supabase.from with knowledge_bank for indexTask', async () => {
    await indexTask(mockSupabase, 'user-1', {
      id: 'task-1', task_name: 'Lab 4', topic: '15-213',
      task_type_tag: 'lab', due_date: null, description: null,
    })
    expect(mockSupabase.from).toHaveBeenCalledWith('knowledge_bank')
  })

  it('calls supabase.from with knowledge_bank for indexNote', async () => {
    await indexNote(mockSupabase, 'user-1', {
      id: 'note-1', content: 'Test note', notepad_id: 'pad-1',
    })
    expect(mockSupabase.from).toHaveBeenCalledWith('knowledge_bank')
  })
})
