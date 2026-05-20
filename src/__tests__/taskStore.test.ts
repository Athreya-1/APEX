import { act } from '@testing-library/react'

describe('taskStore', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('setTasks replaces the task list', async () => {
    const { useTaskStore } = await import('@/stores/taskStore')
    const task = { id: '1', task_name: 'Lab 4', status: 'pending' } as any
    act(() => useTaskStore.getState().setTasks([task]))
    expect(useTaskStore.getState().tasks).toHaveLength(1)
    expect(useTaskStore.getState().tasks[0].id).toBe('1')
  })

  it('addTask prepends to the list', async () => {
    const { useTaskStore } = await import('@/stores/taskStore')
    const existing = { id: '1', task_name: 'Old', status: 'pending' } as any
    const newTask = { id: '2', task_name: 'New', status: 'pending' } as any
    act(() => {
      useTaskStore.getState().setTasks([existing])
      useTaskStore.getState().addTask(newTask)
    })
    expect(useTaskStore.getState().tasks[0].id).toBe('2')
  })

  it('updateTask patches a task by id', async () => {
    const { useTaskStore } = await import('@/stores/taskStore')
    const task = { id: '1', task_name: 'Lab 4', status: 'pending', estimated_hours: 3 } as any
    act(() => {
      useTaskStore.getState().setTasks([task])
      useTaskStore.getState().updateTask('1', { estimated_hours: 4 })
    })
    expect(useTaskStore.getState().tasks[0].estimated_hours).toBe(4)
  })

  it('removeTask removes by id', async () => {
    const { useTaskStore } = await import('@/stores/taskStore')
    const task = { id: '1', task_name: 'Lab 4', status: 'pending' } as any
    act(() => {
      useTaskStore.getState().setTasks([task])
      useTaskStore.getState().removeTask('1')
    })
    expect(useTaskStore.getState().tasks).toHaveLength(0)
  })

  it('setSelectedTaskId sets the selection', async () => {
    const { useTaskStore } = await import('@/stores/taskStore')
    act(() => useTaskStore.getState().setSelectedTaskId('abc'))
    expect(useTaskStore.getState().selectedTaskId).toBe('abc')
  })
})
