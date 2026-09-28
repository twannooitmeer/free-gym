'use client'

import { useEffect, useState } from 'react'

import { GRID_PX_PER_MIN } from '@/lib/schedule'

type Props = {
  label: string
  startHour: number
  endHour: number
}

/**
 * Apple-calendar-style horizontal line indicating the current time within
 * the day column. Re-renders every minute. Hidden outside the grid's
 * configured open hours.
 */
export function NowLine({ label, startHour, endHour }: Props) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Recomputed every render; `tick` triggers the re-render only.
  void tick
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const gridMinutes = minutes - startHour * 60
  const maxMinutes = (endHour - startHour) * 60
  if (gridMinutes < 0 || gridMinutes > maxMinutes) {
    return null
  }
  const top = gridMinutes * GRID_PX_PER_MIN

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center gap-2"
      style={{ top: `${top}px` }}
      aria-hidden="true"
    >
      <span className="rounded-sm bg-[color:var(--color-accent)] px-1 py-0.5 text-[10px] font-bold tracking-wider text-white">
        {label}
      </span>
      <div className="h-px flex-1 bg-[color:var(--color-accent)]" />
    </div>
  )
}
