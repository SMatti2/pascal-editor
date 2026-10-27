'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * One picture the viewer can show: the large image, its alt and a caption. `drawing`: a vector
 * sheet on white, scaled up to fill the screen (a photo is never enlarged).
 */
export type ViewerItem = { src: string; alt: string; caption: string; drawing?: boolean }

const ROUND =
  'flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'

/**
 * Pictures full screen over the editor: Esc or a click outside closes, ← → step through them.
 * `index` null keeps it closed.
 */
export function Viewer({
  items,
  index,
  onIndex,
}: {
  items: ViewerItem[]
  index: number | null
  onIndex: (index: number | null) => void
}) {
  const item = index === null ? undefined : items[index]
  const step = (by: number) => index !== null && onIndex((index + by + items.length) % items.length)

  useEffect(() => {
    if (index === null || items.length < 2) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <Dialog.Root onOpenChange={(open) => !open && onIndex(null)} open={item !== undefined}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[101] flex flex-col items-center justify-center gap-3 p-6 outline-none"
          onClick={(event) => event.target === event.currentTarget && onIndex(null)}
        >
          {item && (
            <>
              <Dialog.Title className="sr-only">{item.alt}</Dialog.Title>
              <img
                alt={item.alt}
                className={`rounded-md object-contain shadow-2xl ${item.drawing ? 'h-[calc(100vh-7rem)] w-full bg-white p-4' : 'max-h-[calc(100vh-7rem)] max-w-full'}`}
                src={item.src}
              />
              <div className="flex items-center gap-3 text-sm text-white/80 tabular-nums">
                <span>{item.caption}</span>
                {items.length > 1 && (
                  <span className="text-white/50">
                    {(index ?? 0) + 1} / {items.length}
                  </span>
                )}
                <a
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  href={item.src}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden className="size-3.5" />
                  Originale
                </a>
              </div>
              {items.length > 1 && (
                <>
                  <button
                    aria-label="Foto precedente"
                    className={`${ROUND} absolute top-1/2 left-4 -translate-y-1/2`}
                    onClick={() => step(-1)}
                    type="button"
                  >
                    <ChevronLeft aria-hidden className="size-5" />
                  </button>
                  <button
                    aria-label="Foto successiva"
                    className={`${ROUND} absolute top-1/2 right-4 -translate-y-1/2`}
                    onClick={() => step(1)}
                    type="button"
                  >
                    <ChevronRight aria-hidden className="size-5" />
                  </button>
                </>
              )}
              <Dialog.Close aria-label="Chiudi" className={`${ROUND} absolute top-4 right-4`}>
                <X aria-hidden className="size-5" />
              </Dialog.Close>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
