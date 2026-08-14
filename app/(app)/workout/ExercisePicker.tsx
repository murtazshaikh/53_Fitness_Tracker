'use client'

import { useMemo, useState } from 'react'
import type { ExerciseTypeWire } from '@/lib/workout/types'

export type TemplateSummary = {
  id: string
  title: string
  type: ExerciseTypeWire
  primary_muscle_group: string
  equipment_category: string
  is_custom: boolean
}

const humanise = (s: string) => s.replace(/_/g, ' ')

export function ExercisePicker({
  templates, onAdd, onClose,
}: {
  templates: TemplateSummary[]
  onAdd: (ids: string[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const muscles = useMemo(
    () => [...new Set(templates.map(t => t.primary_muscle_group))].sort(),
    [templates],
  )

  const visible = useMemo(() => templates.filter(t => {
    const matchesQuery = t.title.toLowerCase().includes(query.trim().toLowerCase())
    const matchesMuscle = muscle === '' || t.primary_muscle_group === muscle
    return matchesQuery && matchesMuscle
  }), [templates, query, muscle])

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div
      role="dialog"
      aria-label="Add exercises"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-white text-neutral-900"
    >
      <header className="border-b border-neutral-200">
        {/* Every band gets the same max-width container so the modal stays a
            readable column instead of spanning a wide monitor. */}
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Add exercises</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-2">
            <input
              aria-label="Search exercises"
              placeholder="Search exercises"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Muscle group"
              className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-neutral-900 focus:border-blue-500 focus:outline-none"
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
            >
              <option value="">All muscles</option>
              {muscles.map(m => <option key={m} value={m}>{humanise(m)}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4">
          {visible.length === 0 ? (
            <p className="py-16 text-center text-neutral-500">No exercises match that search.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {visible.map(t => {
                const isSelected = selected.includes(t.id)
                return (
                  <li key={t.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-3 ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        aria-label={t.title}
                        checked={isSelected}
                        onChange={() => toggle(t.id)}
                        className="size-5 shrink-0 accent-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-neutral-900">{t.title}</span>
                        <span className="block text-xs text-neutral-500">
                          {humanise(t.primary_muscle_group)}
                          {t.is_custom && <span className="ml-2 text-blue-600">custom</span>}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => { onAdd(selected); onClose() }}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            {selected.length === 0
              ? 'Add exercises'
              : `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </footer>
    </div>
  )
}
