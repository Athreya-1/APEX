import { parsedTaskToInsert } from '@/lib/tasks/quick-add-map'

describe('parsedTaskToInsert', () => {
  it('maps a parsed task to insert fields', () => {
    const row = parsedTaskToInsert({
      kind: 'task',
      title: 'Lab 3',
      courseCode: '15-213',
      taskType: 'lab',
      dueDate: '2026-06-05T23:59:00.000Z',
      doDate: null,
      estimateHours: 4,
      confidence: 0.8,
    }, '15-213')
    expect(row.task_name).toBe('Lab 3')
    expect(row.topic).toBe('15-213')
    expect(row.task_type_tag).toBe('lab')
    expect(row.importance).toBeGreaterThanOrEqual(1)
  })
})
