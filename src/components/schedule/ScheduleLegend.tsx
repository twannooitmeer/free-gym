import { getTranslations } from 'next-intl/server'

import type { ScheduleThemeColors } from '@/lib/scheduleTheme'

type Props = {
  colors: ScheduleThemeColors
}

/**
 * Small color legend rendered above the schedule grid so visitors can
 * decode the three session background colors at a glance.
 */
export async function ScheduleLegend({ colors }: Props) {
  const t = await getTranslations('schedule.legend')
  const items: Array<{ key: 'past' | 'future' | 'booked'; color: string }> = [
    { key: 'past', color: colors.past },
    { key: 'future', color: colors.future },
    { key: 'booked', color: colors.booked },
  ]
  return (
    <ul
      className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[color:var(--color-text-muted)]"
      aria-label={t('label')}
    >
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-sm border border-[color:var(--color-border)]"
            style={{ backgroundColor: it.color }}
          />
          <span>{t(it.key)}</span>
        </li>
      ))}
    </ul>
  )
}
