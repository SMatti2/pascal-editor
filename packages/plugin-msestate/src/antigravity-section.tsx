import { useCallback, useState } from 'react'
import type { SavedCapture } from './capture'
import { ReferencePicker } from './reference-picker'
import { copyWhenReady, createRequest, listRequests, type ReferenceChoice } from './requests'
import { ResultList, requestEntry } from './result-list'
import { usePolling } from './use-polling'
import { useStep } from './use-step'

const APPEARANCE_MAX = 4000

/** Hand the capture to Antigravity with an appearance brief and references; its results appear below. */
export function AntigravitySection({
  sceneId,
  capture,
}: {
  sceneId: string
  capture: SavedCapture | null
}) {
  const [appearance, setAppearance] = useState('')
  const [references, setReferences] = useState<ReferenceChoice[]>([])
  const { busy, run, line } = useStep()
  const load = useCallback(() => listRequests(sceneId), [sceneId])
  const { items, error, refresh } = usePolling(load)

  const handOff = (from: SavedCapture) =>
    run(
      'Preparo la richiesta…',
      async () => {
        const request = createRequest(sceneId, from.id, appearance, references)
        await copyWhenReady(request.then((prepared) => prepared.instructions))
        await refresh()
      },
      'Istruzioni copiate. Incollale in Antigravity con il repository msestate aperto: il risultato compare qui sotto.',
    )

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium text-sm">Antigravity</h3>
      {capture && (
        <>
          <label className="flex flex-col gap-1 text-xs">
            Aspetto (facoltativo): finiture, luce, atmosfera
            <textarea
              className="min-h-20 rounded-md border border-sidebar-border bg-transparent p-2 text-sm"
              maxLength={APPEARANCE_MAX}
              onChange={(event) => setAppearance(event.target.value)}
              value={appearance}
            />
          </label>
          <ReferencePicker chosen={references} onChange={setReferences} sceneId={sceneId} />
          <button
            className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() => handOff(capture)}
            type="button"
          >
            Copia istruzioni per Antigravity
          </button>
        </>
      )}
      {line}
      {error && <p className="text-destructive text-xs">{error}</p>}
      <ResultList entries={items.map(requestEntry)} sceneId={sceneId} />
    </section>
  )
}
