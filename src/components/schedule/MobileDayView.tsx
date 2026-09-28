'use client'

import { useState } from 'react'

import { Link } from '@/i18n/navigation'
import { formatDayHeader, formatTime, isSameLocalDay } from '@/lib/schedule'
import type { ScheduleThemeColors } from '@/lib/scheduleTheme'

type Session = {
  id: number | string
  title?: string | null
  startsAt: string
  durationMinutes: number
  capacity: number
  bookingCount: number
  bookedByMe: boolean
  /** Pre-translated, count-aware capacity line (server renders it so we don't
   *  have to ship a translator into the client bundle). */
  capacityLabel: string
  type?: { name: string; color?: string | null } | null
  teacher?: { name: string } | null
}

type Props = {
  /** ISO date strings (YYYY-MM-DD) for the 7 days of the week, Monday first. */
  dayIsos: string[]
  /** Sessions bucketed by the same ISO date keys as `dayIsos`. */
  sessionsByDay: Record<string, Session[]>
  /** Translated labels (avoids passing the i18n client provider through).
   *  Only plain strings here, functions cannot cross the server/client boundary. */
  labels: {
    with: string
    book: string
    booked: string
    full: string
    loginToBook: string
    noSessions: string
  }
  locale: string
  viewerIsCustomer: boolean
  /** Server render time, so server and client agree on "now" (no hydration mismatch). */
  nowMs: number
  themeColors: ScheduleThemeColors
}

/**
 * Mobile-only day view. A horizontal day picker on top, one day's session
 * list below. Avoids the cramped 7-column grid on small screens.
 */
export function MobileDayView({
  dayIsos,
  sessionsByDay,
  labels,
  locale,
  viewerIsCustomer,
  themeColors,
  nowMs,
}: Props) {
  const today = new Date(nowMs)
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const initialIdx = Math.max(
    0,
    dayIsos.findIndex((iso) => iso === todayIso),
  )
  const [activeIdx, setActiveIdx] = useState(initialIdx === -1 ? 0 : initialIdx)
  const activeIso = dayIsos[activeIdx]
  const activeDate = parseLocalIso(activeIso)
  const sessions = sessionsByDay[activeIso] ?? []
  const now = nowMs

  return (
    <div className="md:hidden">
      {/* Day picker */}
      <div className="-mx-6 overflow-x-auto px-6 pb-2">
        <div className="flex min-w-min gap-2">
          {dayIsos.map((iso, i) => {
            const d = parseLocalIso(iso)
            const isToday = isSameLocalDay(d, today)
            const isActive = i === activeIdx
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`flex shrink-0 flex-col items-center rounded-md border px-3 py-2 text-xs transition ${
                  isActive
                    ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white'
                    : isToday
                      ? 'border-[color:var(--color-accent)]/50 text-[color:var(--color-accent)]'
                      : 'border-[color:var(--color-border)] text-[color:var(--color-text-muted)]'
                }`}
              >
                <span className="text-[10px] uppercase tracking-widest">
                  {new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
                    weekday: 'short',
                  }).format(d)}
                </span>
                <span className="display text-lg leading-none">{d.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day's sessions */}
      <div className="mt-4">
        <h3 className="mb-3 text-xs uppercase tracking-widest text-[color:var(--color-text-muted)]">
          {formatDayHeader(activeDate, locale)}
        </h3>
        {sessions.length === 0 ? (
          <p className="rounded-md border border-dashed border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-text-muted)]">
            {labels.noSessions}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const start = new Date(s.startsAt)
              const end = new Date(start.getTime() + s.durationMinutes * 60_000)
              const isPast = end.getTime() < now
              const remaining = Math.max(0, s.capacity - s.bookingCount)
              const isFull = remaining === 0
              const accent = s.type?.color || 'var(--color-accent)'
              const title = s.title || s.type?.name || ''
              const isClickable = !isPast && !isFull && !s.bookedByMe
              const bg = isPast
                ? themeColors.past
                : s.bookedByMe
                  ? themeColors.booked
                  : themeColors.future
              const stateLabel = isPast
                ? null
                : s.bookedByMe
                  ? labels.booked
                  : isFull
                    ? labels.full
                    : null

              const liClass = `block rounded-md border p-3 transition ${
                isPast ? 'opacity-60' : ''
              } ${
                isClickable
                  ? 'cursor-pointer hover:border-[color:var(--color-accent)]'
                  : ''
              }`
              const liStyle: React.CSSProperties = {
                backgroundColor: bg,
                borderColor: 'var(--color-border)',
                borderLeft: `3px solid ${accent}`,
              }

              const inner = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                      {formatTime(start, locale)}–{formatTime(end, locale)}
                      {s.teacher ? ` · ${labels.with} ${s.teacher.name}` : ''}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[color:var(--color-text-dim)]">
                      {s.capacityLabel}
                    </p>
                  </div>
                  {stateLabel && (
                    <span className="shrink-0 self-center rounded-sm bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      {stateLabel}
                    </span>
                  )}
                </div>
              )

              return isClickable ? (
                <li key={s.id}>
                  <Link
                    href={`/book/${s.id}`}
                    className={liClass}
                    style={liStyle}
                    aria-label={`${labels.book}: ${title}, ${formatTime(start, locale)}`}
                  >
                    {inner}
                  </Link>
                </li>
              ) : (
                <li key={s.id} className={liClass} style={liStyle}>
                  {inner}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function parseLocalIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}
