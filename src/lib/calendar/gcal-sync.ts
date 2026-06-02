import type { GCalEvent } from './gcal'

export interface SyncableBlock {
  id: string
  label: string | null
  description?: string | null
  start_time: string
  end_time: string
  block_type: string
  gcal_event_id?: string | null
}

export interface GCalSyncDiff {
  toCreate: SyncableBlock[]
  toUpdate: Array<{ block: SyncableBlock; gcalEventId: string }>
  toDelete: string[] // gcal event ids
}

/**
 * Diff desired APEX blocks against existing GCal events for the day.
 * - Blocks without gcal_event_id → create (unless a matching apex_block_id event exists)
 * - Blocks with gcal_event_id → update if times/label changed
 * - Orphan apex GCal events (apex_block_id not in current plan) → delete
 */
export function diffGCalBlocks(
  blocks: SyncableBlock[],
  existingEvents: GCalEvent[],
): GCalSyncDiff {
  const apexEvents = existingEvents.filter((e) => e.apex_block_id)
  const blockIds = new Set(blocks.map((b) => b.id))

  const toCreate: SyncableBlock[] = []
  const toUpdate: Array<{ block: SyncableBlock; gcalEventId: string }> = []
  const toDelete: string[] = []

  for (const block of blocks) {
    if (block.block_type === 'break' || block.block_type === 'sleep') continue

    const linked = block.gcal_event_id
      ? apexEvents.find((e) => e.id === block.gcal_event_id)
      : apexEvents.find((e) => e.apex_block_id === block.id)

    if (!linked) {
      toCreate.push(block)
    } else if (
      linked.start !== block.start_time
      || linked.end !== block.end_time
      || linked.title !== `[APEX] ${block.label ?? block.block_type}`
    ) {
      toUpdate.push({ block, gcalEventId: linked.id })
    }
  }

  for (const ev of apexEvents) {
    if (ev.apex_block_id && !blockIds.has(ev.apex_block_id)) {
      toDelete.push(ev.id)
    }
  }

  return { toCreate, toUpdate, toDelete }
}

export interface GCalSyncFns {
  create: (block: SyncableBlock) => Promise<string | null>
  update: (gcalEventId: string, block: SyncableBlock) => Promise<void>
  remove: (gcalEventId: string) => Promise<void>
}

/** Apply a diff; returns map of blockId → new gcal event id for creates. */
export async function applyGCalSync(
  diff: GCalSyncDiff, fns: GCalSyncFns,
): Promise<Record<string, string>> {
  const created: Record<string, string> = {}
  for (const id of diff.toDelete) await fns.remove(id)
  for (const { block, gcalEventId } of diff.toUpdate) await fns.update(gcalEventId, block)
  for (const block of diff.toCreate) {
    const id = await fns.create(block)
    if (id) created[block.id] = id
  }
  return created
}
