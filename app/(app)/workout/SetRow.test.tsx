import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SetRow } from './SetRow'
import type { DraftSet } from '@/lib/workout/types'

const set = (o: Partial<DraftSet> = {}): DraftSet => ({
  type: 'normal', weightKg: null, reps: null, distanceMeters: null,
  durationSeconds: null, rpe: null, completed: false, ...o,
})

const noop = () => {}

describe('SetRow', () => {
  it('renders weight and reps inputs for weight_reps', () => {
    render(<SetRow index={0} set={set()} type="weight_reps" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByLabelText(/weight/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reps/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/distance/i)).not.toBeInTheDocument()
  })

  it('renders only reps for bodyweight_reps', () => {
    render(<SetRow index={0} set={set()} type="bodyweight_reps" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByLabelText(/reps/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/weight/i)).not.toBeInTheDocument()
  })

  it('renders distance and duration for distance_duration', () => {
    render(<SetRow index={0} set={set()} type="distance_duration" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByLabelText(/distance/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/reps/i)).not.toBeInTheDocument()
  })

  it('labels weight as assist for assisted bodyweight', () => {
    render(<SetRow index={0} set={set()} type="bodyweight_assisted_reps" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByLabelText(/assist/i)).toBeInTheDocument()
  })

  it('shows derived speed once distance and duration are both present', () => {
    render(<SetRow index={0} set={set({ distanceMeters: 5000, durationSeconds: 1695 })}
                   type="distance_duration" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.getByText(/10\.6 km\/h/)).toBeInTheDocument()
  })

  it('shows no speed when duration is missing', () => {
    render(<SetRow index={0} set={set({ distanceMeters: 5000 })}
                   type="distance_duration" system="metric"
                   previous={null} onChange={noop} onDelete={noop} />)

    expect(screen.queryByText(/km\/h/)).not.toBeInTheDocument()
  })

  it('reports weight edits back in kilograms', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set()} type="weight_reps" system="metric"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '60' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 60 }))
  })

  it('converts pounds back to kilograms under imperial', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set()} type="weight_reps" system="imperial"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '220.462' } })
    const arg = onChange.mock.calls[0][0] as DraftSet
    expect(arg.weightKg).toBeCloseTo(100, 3)
  })

  it('clears a field to null when emptied, not to zero', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set({ reps: 10 })} type="weight_reps" system="metric"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.change(screen.getByLabelText(/reps/i), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ reps: null }))
  })

  it('toggles completion', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set()} type="weight_reps" system="metric"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /complete set/i }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ completed: true }))
  })

  it('cycles the set type when the set number is clicked', () => {
    const onChange = vi.fn()
    render(<SetRow index={0} set={set({ type: 'normal' })} type="weight_reps" system="metric"
                   previous={null} onChange={onChange} onDelete={noop} />)

    fireEvent.click(screen.getByRole('button', { name: /set type/i }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'warmup' }))
  })

  it('shows previous performance when given', () => {
    render(<SetRow index={0} set={set()} type="weight_reps" system="metric"
                   previous="60 × 10" onChange={noop} onDelete={noop} />)

    expect(screen.getByText('60 × 10')).toBeInTheDocument()
  })
})
