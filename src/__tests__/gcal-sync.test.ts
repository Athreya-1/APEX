import { applyGCalSync, diffGCalBlocks } from '@/lib/calendar/gcal-sync'

describe('diffGCalBlocks', () => {
  const block = (id: string, start: string, end: string, gcal?: string) => ({
    id, label: 'Lab', start_time: start, end_time: end, block_type: 'deep_work', gcal_event_id: gcal ?? null,
  })

  it('creates blocks without a linked GCal event', () => {
    const diff = diffGCalBlocks(
      [block('b1', '2026-06-01T10:00:00.000Z', '2026-06-01T12:00:00.000Z')],
      [],
    )
    expect(diff.toCreate.length).toBe(1)
    expect(diff.toUpdate.length).toBe(0)
  })

  it('updates when times change', () => {
    const diff = diffGCalBlocks(
      [block('b1', '2026-06-01T10:00:00.000Z', '2026-06-01T13:00:00.000Z', 'g1')],
      [{ id: 'g1', title: '[APEX] Lab', start: '2026-06-01T10:00:00.000Z', end: '2026-06-01T12:00:00.000Z', apex_block_id: 'b1' }],
    )
    expect(diff.toUpdate.length).toBe(1)
  })

  it('deletes orphan apex events', () => {
    const diff = diffGCalBlocks(
      [],
      [{ id: 'g-old', title: '[APEX] Old', start: '2026-06-01T08:00:00.000Z', end: '2026-06-01T09:00:00.000Z', apex_block_id: 'gone' }],
    )
    expect(diff.toDelete).toEqual(['g-old'])
  })
})

describe('applyGCalSync', () => {
  it('calls create/update/delete fns', async () => {
    const calls: string[] = []
    await applyGCalSync(
      {
        toCreate: [{ id: 'b1', label: 'X', start_time: '2026-06-01T10:00:00.000Z', end_time: '2026-06-01T11:00:00.000Z', block_type: 'deep_work' }],
        toUpdate: [{ block: { id: 'b2', label: 'Y', start_time: '2026-06-01T12:00:00.000Z', end_time: '2026-06-01T13:00:00.000Z', block_type: 'deep_work' }, gcalEventId: 'g2' }],
        toDelete: ['g3'],
      },
      {
        create: async () => { calls.push('create'); return 'g-new' },
        update: async () => { calls.push('update') },
        remove: async () => { calls.push('delete') },
      },
    )
    expect(calls.sort()).toEqual(['create', 'delete', 'update'])
  })
})
