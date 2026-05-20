import { createClient } from '@/lib/supabase/server'

interface ReplanBody {
  plan_date: string
  block_id?: string
  extra_mins?: number
  from_time?: string // ISO — replan everything from this time
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body: ReplanBody = await request.json()
  const { plan_date, block_id, extra_mins } = body

  // Get the plan
  const { data: plan } = await supabase
    .from('daily_plans')
    .select('id')
    .eq('user_id', user.id)
    .eq('plan_date', plan_date)
    .single()

  if (!plan) return Response.json({ error: 'No plan found for this date' }, { status: 404 })

  // Extend a specific block and shift all subsequent blocks
  if (block_id && extra_mins) {
    const { data: block } = await supabase
      .from('plan_blocks')
      .select('*')
      .eq('id', block_id)
      .single()

    if (!block) return Response.json({ error: 'Block not found' }, { status: 404 })

    const newEndTime = new Date(new Date(block.end_time).getTime() + extra_mins * 60000).toISOString()

    await supabase.from('plan_blocks').update({ end_time: newEndTime }).eq('id', block_id)

    // Shift all subsequent blocks by extra_mins
    const { data: laterBlocks } = await supabase
      .from('plan_blocks')
      .select('id, start_time, end_time')
      .eq('plan_id', plan.id)
      .gt('start_time', block.end_time)
      .order('start_time')

    for (const lb of laterBlocks ?? []) {
      const newStart = new Date(new Date(lb.start_time).getTime() + extra_mins * 60000).toISOString()
      const newEnd = new Date(new Date(lb.end_time).getTime() + extra_mins * 60000).toISOString()
      await supabase.from('plan_blocks').update({ start_time: newStart, end_time: newEnd }).eq('id', lb.id)
    }

    const { data: updatedBlocks } = await supabase
      .from('plan_blocks')
      .select('*')
      .eq('plan_id', plan.id)
      .order('sort_order')

    return Response.json({ blocks: updatedBlocks })
  }

  return Response.json({ message: 'No replan action specified' })
}
