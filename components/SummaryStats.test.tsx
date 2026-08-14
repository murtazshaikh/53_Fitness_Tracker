import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryStats } from './SummaryStats'
import type { WorkoutSummary } from '@/lib/workout/summary'

const summary = (o: Partial<WorkoutSummary>): WorkoutSummary => ({
  totalSets: 0, volumeKg: null, distanceMeters: null, movingSeconds: null,
  avgSpeed: null, timeUnderTensionSeconds: null, ...o,
})

describe('SummaryStats', () => {
  it('shows volume for a strength workout', () => {
    render(<SummaryStats summary={summary({ totalSets: 4, volumeKg: 4250 })} system="metric" />)
    expect(screen.getByText(/4,250 kg/)).toBeInTheDocument()
    expect(screen.getByText(/4 sets/)).toBeInTheDocument()
  })

  it('shows distance, time and speed for cardio', () => {
    render(<SummaryStats summary={summary({
      totalSets: 1, distanceMeters: 5000, movingSeconds: 1695, avgSpeed: 10.619,
    })} system="metric" />)

    expect(screen.getByText(/5\.0 km/)).toBeInTheDocument()
    expect(screen.getByText(/28:15/)).toBeInTheDocument()
    expect(screen.getByText(/10\.6 km\/h/)).toBeInTheDocument()
  })

  it('omits stats that do not apply rather than showing zero', () => {
    render(<SummaryStats summary={summary({ totalSets: 2 })} system="metric" />)
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument()
    expect(screen.queryByText(/km/)).not.toBeInTheDocument()
    expect(screen.getByText(/2 sets/)).toBeInTheDocument()
  })

  it('uses imperial labels when asked', () => {
    render(<SummaryStats summary={summary({ totalSets: 1, volumeKg: 100 })} system="imperial" />)
    expect(screen.getByText(/lb/)).toBeInTheDocument()
  })
})
