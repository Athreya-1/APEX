import { renderHook, act } from '@testing-library/react'
import { usePlanStore } from '@/stores/planStore'

beforeEach(() => {
  usePlanStore.setState({
    plan: null, blocks: [], isLoading: false, isGenerating: false,
    activeCheckinBlockId: null, error: null,
  })
})

describe('planStore', () => {
  it('sets blocks', () => {
    const { result } = renderHook(() => usePlanStore())
    act(() => result.current.setBlocks([{ id: 'b1' } as any]))
    expect(result.current.blocks).toHaveLength(1)
  })

  it('updates a block', () => {
    const { result } = renderHook(() => usePlanStore())
    act(() => result.current.setBlocks([{ id: 'b1', status: 'scheduled' } as any]))
    act(() => result.current.updateBlock('b1', { status: 'done' }))
    expect(result.current.blocks[0].status).toBe('done')
  })

  it('sets generating state', () => {
    const { result } = renderHook(() => usePlanStore())
    act(() => result.current.setGenerating(true))
    expect(result.current.isGenerating).toBe(true)
  })
})
