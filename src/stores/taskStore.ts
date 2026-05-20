// src/stores/taskStore.ts
import { create } from 'zustand'
import type { Task } from '@/types'

interface TaskState {
  tasks: Task[]
  selectedTaskId: string | null
  isLoading: boolean
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  removeTask: (id: string) => void
  setSelectedTaskId: (id: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  selectedTaskId: null,
  isLoading: false,
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, patch) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
}))
