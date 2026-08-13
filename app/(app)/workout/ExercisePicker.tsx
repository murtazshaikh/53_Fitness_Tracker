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
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      <div className="flex gap-2 border-b p-4">
        <input
          aria-label="Search exercises"
          placeholder="Search exercises"
          autoFocus
          className="flex-1 rounded border border-neutral-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Muscle group"
          className="rounded border border-neutral-300 px-2 py-2"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">All muscles</option>
          {muscles.map(m => <option key={m} value={m}>{humanise(m)}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-auto px-4">
        {visible.length === 0 ? (
          <p className="py-12 text-center text-neutral-500">No exercises match that search.</p>
        ) : (
          <ul>
            {visible.map(t => (
              <li key={t.id} className="border-b border-neutral-100">
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={t.title}
                    checked={selected.includes(t.id)}
                    onChange={() => toggle(t.id)}
                    className="size-5 accent-blue-600"
                  />
                  <span>
                    <span className="block">{t.title}</span>
                    <span className="block text-xs text-neutral-500">
                      {humanise(t.primary_muscle_group)}
                      {t.is_custom && <span className="ml-2 text-blue-600">custom</span>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 border-t p-4">
        <button type="button" onClick={onClose} className="rounded border px-4 py-2">
          Cancel
        </button>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => { onAdd(selected); onClose() }}
          className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          {selected.length === 0
            ? 'Add exercises'
            : `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
