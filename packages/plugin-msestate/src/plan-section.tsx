import { useScene } from '@pascal-app/core'
import { useEffect, useState } from 'react'
import { exportGlb } from './cycles'
import { errorMessage } from './http'
import { currentPlan, drawPlan, type Plan, planDimensions, sheetUrl } from './plan'
import { useStep } from './use-step'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Our drawing of the scene as it is now: cut walls, pens and dimension chains, 1:50 SVG and DXF. */
export function PlanSection({ sceneId }: { sceneId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { busy, run, line } = useStep()

  useEffect(() => {
    currentPlan(sceneId)
      .then(setPlan)
      .catch((failure) => setError(errorMessage(failure)))
  }, [sceneId])

  const draw = () => {
    const { dimensions, dangling } = planDimensions(useScene.getState().nodes)
    const left = dangling
      ? `; ${count(dangling, 'quota staccata', 'quote staccate')} lasciate fuori`
      : ''
    return run(
      'Esporto il modello…',
      async () => setPlan(await drawPlan(sceneId, await exportGlb(), dimensions)),
      `Pianta disegnata${left}.`,
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium text-sm">Pianta</h3>
      <button
        className="rounded-md bg-sidebar-accent px-3 py-2 font-medium text-sm disabled:opacity-50"
        disabled={busy}
        onClick={draw}
        type="button"
      >
        {plan ? 'Ridisegna la pianta' : 'Disegna la pianta'}
      </button>
      {line}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {plan && (
        <>
          <a href={sheetUrl(sceneId, 'svg', plan.drawn_at)} rel="noreferrer" target="_blank">
            <img
              alt="Pianta disegnata"
              className="w-full rounded bg-white"
              src={sheetUrl(sceneId, 'svg', plan.drawn_at)}
            />
          </a>
          <p className="text-sidebar-foreground/70 text-xs">
            {new Date(plan.drawn_at).toLocaleString('it-IT', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
            {plan.dimensions ? ` · ${count(plan.dimensions, 'quota', 'quote')}` : ''}
            {plan.oblique_left_out ? ` · ${plan.oblique_left_out} oblique lasciate fuori` : ''}
            {' · '}
            <a className="underline" download href={sheetUrl(sceneId, 'dxf', plan.drawn_at)}>
              DXF
            </a>
          </p>
        </>
      )}
    </section>
  )
}
