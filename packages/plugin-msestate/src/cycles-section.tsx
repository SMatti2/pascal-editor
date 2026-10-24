import { useCallback, useState } from 'react'
import type { SavedCapture } from './capture'
import { exportGlb, listRenders, startRender } from './cycles'
import { ResultList, renderEntry } from './result-list'
import { usePolling } from './use-polling'
import { useStep } from './use-step'

/** Redraw the capture in Blender Cycles from its stored camera, with the model as it is now. */
export function CyclesSection({
  sceneId,
  capture,
}: {
  sceneId: string
  capture: SavedCapture | null
}) {
  const [sunAt, setSunAt] = useState('')
  const { busy, run, line } = useStep()
  const load = useCallback(() => listRenders(sceneId), [sceneId])
  const { items, error, refresh } = usePolling(load)

  const render = (from: SavedCapture) =>
    run(
      'Esporto il modello…',
      async () => {
        await startRender(sceneId, from.id, await exportGlb(), sunAt)
        await refresh()
      },
      'In coda per Blender: il render compare qui sotto.',
    )

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium text-sm">Cycles</h3>
      {capture && (
        <label className="flex flex-col gap-1 text-xs">
          Sole reale (facoltativo): data e ora nel luogo del progetto; vuoto = luce neutra
          <input
            className="rounded-md border border-sidebar-border bg-transparent p-1 text-sm"
            onChange={(event) => setSunAt(event.target.value)}
            type="datetime-local"
            value={sunAt}
          />
        </label>
      )}
      {capture && (
        <button
          className="rounded-md bg-sidebar-accent px-3 py-2 font-medium text-sm disabled:opacity-50"
          disabled={busy}
          onClick={() => render(capture)}
          type="button"
        >
          Render Cycles di questa vista
        </button>
      )}
      {line}
      {error && <p className="text-destructive text-xs">{error}</p>}
      <ResultList entries={items.map(renderEntry)} sceneId={sceneId} />
    </section>
  )
}
