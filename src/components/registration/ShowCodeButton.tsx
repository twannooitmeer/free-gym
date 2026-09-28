'use client'

import { useEffect, useState } from 'react'

type Props = {
  /** QR code as SVG markup, rendered on the server by lib/checkIn.ts. */
  qrSvg: string
  gymName: string
  title: string
  when: string
  labels: { show: string; hint: string; close: string }
}

/**
 * "Show code at the counter": a full-screen, white, high-contrast view of
 * the booking's QR code, so a scanner at the desk reads it first time.
 * Asks the browser to keep the screen on while it is open.
 */
export function ShowCodeButton({ qrSvg, gymName, title, when, labels }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      void lock?.release().catch(() => {})
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md bg-[color:var(--color-accent)] px-6 py-4 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
      >
        {labels.show}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={labels.show}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6 text-center text-black"
          onClick={() => setOpen(false)}
        >
          <p className="text-sm font-semibold uppercase tracking-widest">{gymName}</p>
          <div
            className="aspect-square w-[min(80vw,60vh)] [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div>
            <p className="text-2xl font-bold">{title}</p>
            <p className="mt-1 text-base">{when}</p>
          </div>
          <p className="text-sm text-neutral-600">{labels.hint}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-neutral-300 px-5 py-2 text-sm font-medium"
          >
            {labels.close}
          </button>
        </div>
      )}
    </>
  )
}
