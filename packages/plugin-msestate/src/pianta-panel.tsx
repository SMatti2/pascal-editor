'use client'

import { useScene } from '@pascal-app/core'
import { Download, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sceneIdFromPath } from './capture'
import { exportGlb } from './cycles'
import { errorMessage } from './http'
import { currentPlan, drawPlan, type Plan, planDimensions, sheetUrl } from './plan'
import { useStep } from './use-step'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const LINK =
  'flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 font-medium text-xs hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Pianta: our 1:50 drawing of the scene as it is now: cut walls, pens, dimension chains, SVG and DXF. */
export default function PiantaPanel() {
  const sceneId = typeof window === 'undefined' ? null : sceneIdFromPath(window.location.pathname)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { busy, run, line } = useStep()

  useEffect(() => {
    if (sceneId) currentPlan(sceneId).then(setPlan, (failure) => setError(errorMessage(failure)))
  }, [sceneId])

  if (!sceneId) return null
  const draw = () => {
    const { dimensions, dangling } = planDimensions(useScene.getState().nodes)
    const left = dangling
      ? `; ${count(dangling, 'quota staccata', 'quote staccate')} lasciate fuori`
      : ''
    return run(
      'Preparo il modello…',
      async () => setPlan(await drawPlan(sceneId, await exportGlb(), dimensions)),
      `Pianta aggiornata${left}.`,
    )
  }
  const notes = plan
    ? [
        new Date(plan.drawn_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }),
        ...(plan.dimensions ? [count(plan.dimensions, 'quota tua', 'quote tue')] : []),
        ...(plan.oblique_left_out ? [`${plan.oblique_left_out} oblique non stampate`] : []),
      ]
    : []

  return (
    <div className="flex flex-col gap-4 p-4 text-sidebar-foreground">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-base">Pianta</h2>
        <p className="text-muted-foreground text-xs">
          La pianta quotata 1:50 del modello com’è adesso, con le quote che hai disegnato.
        </p>
      </div>
      <button
        className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        disabled={busy}
        onClick={draw}
        type="button"
      >
        {plan ? 'Aggiorna la pianta' : 'Disegna la pianta'}
      </button>
      {line}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {plan && (
        <figure className="flex flex-col gap-2">
          <a
            className="block overflow-hidden rounded-md bg-white ring-1 ring-border/50 focus-visible:ring-2 focus-visible:ring-ring"
            href={sheetUrl(sceneId, 'svg', plan.drawn_at)}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt="La pianta disegnata"
              className="aspect-[4/3] w-full object-contain p-1"
              src={sheetUrl(sceneId, 'svg', plan.drawn_at)}
            />
          </a>
          <figcaption className="text-muted-foreground text-xs tabular-nums">
            {notes.join(' · ')}
          </figcaption>
          <div className="flex gap-2">
            <a
              className={LINK}
              href={sheetUrl(sceneId, 'svg', plan.drawn_at)}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden className="size-3.5" />
              Apri
            </a>
            <a className={LINK} download href={sheetUrl(sceneId, 'dxf', plan.drawn_at)}>
              <Download aria-hidden className="size-3.5" />
              Scarica DXF
            </a>
          </div>
        </figure>
      )}
    </div>
  )
}
