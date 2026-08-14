import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExercisePicker, type TemplateSummary } from './ExercisePicker'

const templates: TemplateSummary[] = [
  { id: '1', title: 'Bench Press (Barbell)', type: 'weight_reps', primary_muscle_group: 'chest', equipment_category: 'barbell', is_custom: false },
  { id: '2', title: 'Squat (Barbell)', type: 'weight_reps', primary_muscle_group: 'quadriceps', equipment_category: 'barbell', is_custom: false },
  { id: '3', title: 'Treadmill', type: 'distance_duration', primary_muscle_group: 'cardio', equipment_category: 'machine', is_custom: false },
]

describe('ExercisePicker', () => {
  it('lists every template', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Bench Press (Barbell)')).toBeInTheDocument()
    expect(screen.getByText('Treadmill')).toBeInTheDocument()
  })

  it('filters by search text, case-insensitively', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'bench' } })

    expect(screen.getByText('Bench Press (Barbell)')).toBeInTheDocument()
    expect(screen.queryByText('Treadmill')).not.toBeInTheDocument()
  })

  it('filters by muscle group', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/muscle/i), { target: { value: 'cardio' } })

    expect(screen.getByText('Treadmill')).toBeInTheDocument()
    expect(screen.queryByText('Squat (Barbell)')).not.toBeInTheDocument()
  })

  it('adds several selected exercises at once', () => {
    const onAdd = vi.fn()
    render(<ExercisePicker templates={templates} onAdd={onAdd} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /Bench Press/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Treadmill/ }))
    fireEvent.click(screen.getByRole('button', { name: /add 2 exercises/i }))

    expect(onAdd).toHaveBeenCalledWith(['1', '3'])
  })

  it('disables the add button until something is selected', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add exercises/i })).toBeDisabled()
  })

  it('says so when nothing matches', () => {
    render(<ExercisePicker templates={templates} onAdd={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'zzzz' } })
    expect(screen.getByText(/no exercises match/i)).toBeInTheDocument()
  })
})
