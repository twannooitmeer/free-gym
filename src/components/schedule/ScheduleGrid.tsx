import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import {
  addDays,
  dateToYmd,
  formatDayHeader,
  formatTime,
  GRID_PX_PER_MIN,
  isSameLocalDay,
  minutesFromGridStart,
  weekdayKeyFromDate,
  type WeekdayKey,
} from '@/lib/schedule'
import type { ScheduleThemeColors } from '@/lib/scheduleTheme'

import { MobileDayView } from './MobileDayView'
import { NowLine } from './NowLine'

export type ScheduleSession = {
  id: number | string
  title?: string | null
  startsAt: string
  durationMinutes: number
  capacity: number
  location?: string | null
  type?: {
    id: number | string
    name: string
    slug: string
    color?: string | null
  } | null
  teacher?: {
    id: number | string
    name: string
  } | null
  /** Number of confirmed (non-cancelled) bookings on this session. */
  bookingCount: number
  /** True when the current viewer has already booked this session. */
  bookedByMe: boolean
}

type Props = {
  weekStart: Date
  locale: string
  sessions: ScheduleSession[]
  /** Provided when the viewer is a logged-in customer. Drives button mode. */
  viewerIsCustomer: boolean
  /** Grid first/last hour, derived from the gym's Opening Hours global. */
  startHour: number
  endHour: number
  /** Per-weekday open/close in minutes-since-midnight, or null if closed. */
  openingMap: Record<WeekdayKey, { openMin: number; closeMin: number } | null>
  /** Translated label for closed days, e.g. "Closed" / "Gesloten". */
  closedLabel: string
  /** Admin-tunable background colors per session state. */
  themeColors: ScheduleThemeColors
}

export async function ScheduleGrid({
  weekStart,
  locale,
  sessions,
  viewerIsCustomer,
  startHour,
  endHour,
  openingMap,
  closedLabel,
  themeColors,
}: Props) {
  const t = await getTranslations('schedule')
  const now = new Date()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const HOURS = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)
  const GRID_HEIGHT_PX = (endHour - startHour) * 60 * GRID_PX_PER_MIN

  // Pre-bucket sessions by local day.
  const sessionsByDay = new Map<string, ScheduleSession[]>()
  for (const day of days) sessionsByDay.set(day.toDateString(), [])
  for (const s of sessions) {
    const sd = new Date(s.startsAt)
    const key = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate()).toDateString()
    if (sessionsByDay.has(key)) sessionsByDay.get(key)!.push(s)
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-16 text-center">
        <p className="text-[color:var(--color-text-muted)]">{t('noSessions')}</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop / tablet: column-per-day grid with absolute-positioned blocks. */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border border-[color:var(--color-border)]">
          {/* Header row */}
          <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]" />
          {days.map((d) => {
            const isToday = isSameLocalDay(d, now)
            return (
              <div
                key={`h-${d.toDateString()}`}
                className={`border-b border-l border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-3 text-xs uppercase tracking-wider ${
                  isToday
                    ? 'text-[color:var(--color-accent-text)]'
                    : 'text-[color:var(--color-text-muted)]'
                }`}
              >
                {formatDayHeader(d, locale)}
              </div>
            )
          })}

          {/* Hour scale */}
          <div className="py-3">
            <div className="relative" style={{ height: `${GRID_HEIGHT_PX}px` }}>
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2 text-xs tabular-nums text-[color:var(--color-text-dim)]"
                  style={{ top: `${i * 60 * GRID_PX_PER_MIN}px` }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const isToday = isSameLocalDay(day, now)
            const dayKey = day.toDateString()
            const wkKey = weekdayKeyFromDate(day)
            const opening = openingMap[wkKey]
            const isClosed = !opening
            const daySessions = sessionsByDay.get(dayKey) ?? []
            return (
              <div
                key={`col-${dayKey}`}
                className="relative border-l border-[color:var(--color-border)] py-3"
              >
                {/* Closed-day overlay */}
                {isClosed && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--color-bg)]/60">
                    <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-dim)]">
                      {closedLabel}
                    </span>
                  </div>
                )}

                <div className="relative" style={{ height: `${GRID_HEIGHT_PX}px` }}>
                  {/* Before-open and after-close shading */}
                  {opening && opening.openMin > startHour * 60 && (
                    <div
                      className="absolute left-0 right-0 top-0 bg-[color:var(--color-bg)]/40"
                      style={{ height: `${(opening.openMin - startHour * 60) * GRID_PX_PER_MIN}px` }}
                    />
                  )}
                  {opening && opening.closeMin < endHour * 60 && (
                    <div
                      className="absolute left-0 right-0 bg-[color:var(--color-bg)]/40"
                      style={{
                        top: `${(opening.closeMin - startHour * 60) * GRID_PX_PER_MIN}px`,
                        bottom: 0,
                      }}
                    />
                  )}

                  {/* Hour grid lines */}
                  {HOURS.map((h, i) => (
                    <div
                      key={`grid-${dayKey}-${h}`}
                      className="absolute left-0 right-0 border-t border-[color:var(--color-border)]/40"
                      style={{ top: `${i * 60 * GRID_PX_PER_MIN}px` }}
                    />
                  ))}

                {/* Sessions */}
                {daySessions.map((s) => {
                  const start = new Date(s.startsAt)
                  const top = minutesFromGridStart(start, startHour) * GRID_PX_PER_MIN
                  const height = Math.max(28, s.durationMinutes * GRID_PX_PER_MIN - 2)
                  const end = new Date(start.getTime() + s.durationMinutes * 60_000)
                  const isPast = end < now
                  const remaining = Math.max(0, s.capacity - s.bookingCount)
                  const isFull = remaining === 0
                  const accent = s.type?.color || 'var(--color-accent)'
                  const title = s.title || s.type?.name || 'Session'
                  // Compact mode for short blocks (e.g. 30-min sessions): hide
                  // the capacity line so the title fits.
                  const isCompact = height < 56

                  // Pick background from the admin-tunable theme palette.
                  const bg = isPast
                    ? themeColors.past
                    : s.bookedByMe
                      ? themeColors.booked
                      : themeColors.future

                  // Whole card is clickable when bookable. Past / full /
                  // already-booked cards are non-interactive (visual state
                  // alone communicates why).
                  const isClickable = !isPast && !isFull && !s.bookedByMe
                  const stateLabel = isPast
                    ? null
                    : s.bookedByMe
                      ? t('booked')
                      : isFull
                        ? t('full')
                        : null

                  const cardClass = `group absolute left-1 right-1 flex flex-col gap-1 overflow-hidden rounded-md border p-2 text-xs transition hover:z-10 ${
                    isPast ? 'opacity-60' : ''
                  } ${
                    isClickable
                      ? 'cursor-pointer hover:border-[color:var(--color-accent)]'
                      : ''
                  }`
                  const cardStyle: React.CSSProperties = {
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: bg,
                    borderColor: 'var(--color-border)',
                    borderLeft: `3px solid ${accent}`,
                  }

                  const inner = (
                    <>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[color:var(--color-text)]">
                          {title}
                        </p>
                        <p className="truncate text-xs text-[color:var(--color-text-muted)]">
                          {formatTime(start, locale)}–{formatTime(end, locale)}
                          {s.teacher ? ` · ${t('with')} ${s.teacher.name}` : ''}
                        </p>
                        {!isCompact && (
                          <p className="truncate text-xs text-[color:var(--color-text-muted)]">
                            {t('capacityLeft', { count: remaining })}
                          </p>
                        )}
                      </div>
                      {stateLabel && (
                        <span className="pointer-events-none absolute right-1.5 top-1 rounded-sm bg-black/30 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
                          {stateLabel}
                        </span>
                      )}
                    </>
                  )

                  return isClickable ? (
                    <Link
                      key={s.id}
                      href={`/book/${s.id}`}
                      className={cardClass}
                      style={cardStyle}
                      aria-label={`${t('book')}: ${title}, ${formatTime(start, locale)}`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={s.id} className={cardClass} style={cardStyle}>
                      {inner}
                    </div>
                  )
                })}

                  {isToday && <NowLine label={t('now')} startHour={startHour} endHour={endHour} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: day picker + single-day list (handled by the client component
          so day switching is instant and doesn't trigger a page reload). */}
      <MobileDayView
        nowMs={now.getTime()}
        classCountByDay={Object.fromEntries(
          days.map((d) => [
            dateToYmd(d),
            t('classCount', { count: (sessionsByDay.get(d.toDateString()) ?? []).length }),
          ]),
        )}
        dayIsos={days.map((d) => dateToYmd(d))}
        sessionsByDay={Object.fromEntries(
          days.map((d) => [
            dateToYmd(d),
            (sessionsByDay.get(d.toDateString()) ?? []).map((s) => ({
              id: s.id,
              title: s.title ?? null,
              startsAt: s.startsAt,
              durationMinutes: s.durationMinutes,
              capacity: s.capacity,
              bookingCount: s.bookingCount,
              bookedByMe: s.bookedByMe,
              // Pre-translate here, functions can't be passed to client components.
              capacityLabel: t('capacityLeft', {
                count: Math.max(0, s.capacity - s.bookingCount),
              }),
              type: s.type ? { name: s.type.name, color: s.type.color ?? null } : null,
              teacher: s.teacher ? { name: s.teacher.name } : null,
            })),
          ]),
        )}
        labels={{
          with: t('with'),
          book: t('book'),
          booked: t('booked'),
          full: t('full'),
          loginToBook: t('loginToBook'),
          noSessions: t('noSessionsDay'),
        }}
        locale={locale}
        viewerIsCustomer={viewerIsCustomer}
        themeColors={themeColors}
      />
    </>
  )
}
