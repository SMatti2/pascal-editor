'use client'

import { useCallback, useState } from 'react'
import { thumbnailUrl } from './http'
import { ReferencePicker } from './reference-picker'
import { copyWhenReady, createRequest, listRequests, type ReferenceChoice } from './requests'
import { Gallery, requestTiles } from './results'
import { FIELD, FOCUS, PRIMARY, SMALL } from './ui'
import { usePolling } from './use-polling'
import { useStep } from './use-step'
import { shootViews, type View } from './views'

const APPEARANCE_MAX = 4000

type Props = {
  projectId: string | null
  sceneId: string
  views: View[]
  stale: View[]
  chosen: string | null
  onChoose: (id: string) => void
  onViews: (views: View[]) => void
}

/** The views as thumbnails, two by two; the chosen one is outlined. */
function ViewPicker({
  sceneId,
  views,
  chosen,
  onChoose,
}: Pick<Props, 'sceneId' | 'views' | 'chosen' | 'onChoose'>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-muted-foreground text-xs">Vista</legend>
      <div className="grid grid-cols-2 gap-2">
        {views.map((view) => (
          <button
            aria-pressed={view.id === chosen}
            className={`flex flex-col gap-1 rounded-md p-1 text-left text-xs ${FOCUS} ${view.id === chosen ? 'ring-2 ring-primary' : 'ring-1 ring-border/50 hover:ring-border'}`}
            key={view.id}
            onClick={() => onChoose(view.id)}
            type="button"
          >
            <img
              alt=""
              className="aspect-video w-full rounded object-cover"
              src={thumbnailUrl(sceneId, view.image, 384)}
            />
            <span className="truncate">{view.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Render: a saved view made an ultra-realistic photo. A brief and references go with the view's
 * latest shot; the instructions land on the clipboard for Antigravity; the photo appears below.
 */
export function RenderTab({ projectId, sceneId, views, stale, chosen, onChoose, onViews }: Props) {
  const [appearance, setAppearance] = useState('')
  const [references, setReferences] = useState<ReferenceChoice[]>([])
  const { busy, run, line } = useStep()
  const requests = usePolling(useCallback(() => listRequests(sceneId), [sceneId]))
  const view = views.find((item) => item.id === chosen) ?? views[0]
  const outdated = view !== undefined && stale.includes(view)

  const reshoot = () =>
    projectId &&
    view &&
    run('Rifaccio la vista…', async () => onViews(await shootViews(projectId, sceneId, [view])))
  const send = () =>
    view &&
    run(
      'Preparo la richiesta…',
      async () => {
        const request = createRequest(sceneId, view.capture, appearance, references)
        await copyWhenReady(request.then((prepared) => prepared.instructions))
        await requests.refresh()
      },
      'Istruzioni copiate: incollale in Antigravity. La foto compare qui sotto quando è pronta.',
    )

  return (
    <div className="flex flex-col gap-4">
      {views.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Salva prima una vista nella scheda Viste: la foto parte da lì.
        </p>
      ) : (
        <>
          <ViewPicker
            chosen={view?.id ?? null}
            onChoose={onChoose}
            sceneId={sceneId}
            views={views}
          />
          {outdated && (
            <p className="flex items-center justify-between gap-2 text-amber-500 text-xs">
              La vista mostra il modello di prima.
              <button className={SMALL} disabled={busy} onClick={reshoot} type="button">
                Rifai la vista
              </button>
            </p>
          )}
          <textarea
            aria-label="Aspetto"
            className={`min-h-16 w-full resize-y leading-5 ${FIELD}`}
            maxLength={APPEARANCE_MAX}
            onChange={(event) => setAppearance(event.target.value)}
            placeholder="Aspetto: finiture, luce, atmosfera (facoltativo)"
            value={appearance}
          />
          <ReferencePicker chosen={references} onChange={setReferences} sceneId={sceneId} />
          <button className={PRIMARY} disabled={busy || !view} onClick={send} type="button">
            Prepara per Antigravity
          </button>
          {line}
        </>
      )}
      {requests.error && <p className="text-destructive text-xs">{requests.error}</p>}
      <Gallery sceneId={sceneId} tiles={requests.items.flatMap(requestTiles)} />
    </div>
  )
}
