'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DRAFT_STORAGE_KEY } from './useWorkoutDraft'

export function StartWorkoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    // Clear any stale local draft so a new session does not inherit an old one.
    localStorage.removeItem(DRAFT_STORAGE_KEY)
    await fetch('/api/workouts/start', { method: 'POST' })
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-2xl p-8 text-center">
      <p className="mb-6 text-neutral-500">No workout in progress.</p>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="w-full rounded-lg bg-blue-600 py-4 font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Start Empty Workout'}
      </button>
    </div>
  )
}
