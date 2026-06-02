import { render, screen, fireEvent } from '@testing-library/react'
import { EstimateModal } from '@/components/tasks/EstimateModal'

describe('EstimateModal', () => {
  it('calls onConfirm with selected hours', () => {
    const onConfirm = jest.fn()
    render(
      <EstimateModal
        open
        taskTitle="Lab 3"
        suggestedHours={3}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Set estimate'))
    expect(onConfirm).toHaveBeenCalledWith(3)
  })
})
