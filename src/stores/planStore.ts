// src/stores/planStore.ts
import { create } from 'zustand'
import type { DailyPlan, PlanBlock } from '@/types'

interface PlanState {
  plan: DailyPlan | null
  blocks: PlanBlock[]
  isLoading: boolean
  isGenerating: boolean
  activeCheckinBlockId: string | null
  error: string | null

  setPlan: (plan: DailyPlan | null) => void
  setBlocks: (blocks: PlanBlock[]) => void
  updateBlock: (id: string, patch: Partial<PlanBlock>) => void
  setLoading: (loading: boolean) => void
  setGenerating: (generating: boolean) => void
  setActiveCheckinBlockId: (id: string | null) => void
  setError: (error: string | null) => void
}

export const usePlanStore = create<PlanState>((set) => ({
  plan: null,
  blocks: [],
  isLoading: false,
  isGenerating: false,
  activeCheckinBlockId: null,
  error: null,

  setPlan: (plan) => set({ plan }),
  setBlocks: (blocks) => set({ blocks }),
  updateBlock: (id, patch) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setActiveCheckinBlockId: (id) => set({ activeCheckinBlockId: id }),
  setError: (error) => set({ error }),
}))
