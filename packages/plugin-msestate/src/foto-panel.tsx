'use client'

import { SegmentedControl } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useState } from 'react'
import { captureView, latestCapture, type SavedCapture, sceneIdFromPath } from './capture'
import { exportGlb, listRenders, startRender } from './cycles'
import { thumbnailUrl } from './http'
import { ReferencePicker } from './reference-picker'
import { copyWhenReady, createRequest, listRequests, type ReferenceChoice } from './requests'
import { Gallery, renderTile, requestTiles } from './results'
import { usePolling } from './use-polling'
import { useStep } from './use-step'
import { Viewer } from './viewer'

type Route = 'antigravity' | 'blender'
const ROUTES: { label: string; value: Route }[] = [
  { label: 'Antigravity', value: 'antigravity' },
  { label: 'Blender', value: 'blender' },
]
const APPEARANCE_MAX = 4000
const when = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
const PRIMARY =
  'rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

/** Antigravity: a brief and references go with the capture; the instructions land on the clipboard. */
function AntigravityForm({ sceneId, capture, onSent }: FormProps) {
  const [appearance, setAppearance] = useState('')
  const [references, setReferences] = useState<ReferenceChoice[]>([])
  const { busy, run, line } = useStep()
  const send = () =>
    run(
      'Preparo la richiesta…',
      async () => {
        const request = createRequest(sceneId, capture.id, appearance, references)
        await copyWhenReady(request.then((prepared) => prepared.instructions))
        await onSent()
      },
      'Istruzioni copiate: incollale in Antigravity. La foto compare qui sotto quando è pronta.',
    )
  return (
    <div className="flex flex-col gap-3">
      <textarea
        aria-label="Aspetto"
        className="min-h-16 w-full resize-y rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        maxLength={APPEARANCE_MAX}
        onChange={(event) => setAppearance(event.target.value)}
        placeholder="Aspetto: finiture, luce, atmosfera (facoltativo)"
        value={appearance}
      />
      <ReferencePicker chosen={references} onChange={setReferences} sceneId={sceneId} />
      <button className={PRIMARY} disabled={busy} onClick={send} type="button">
        Prepara per Antigravity
      </button>
      {line}
    </div>
  )
}

/** Blender: the same camera redrawn with the model as it is now, in neutral light or the real sun. */
function BlenderForm({ sceneId, capture, onSent }: FormProps) {
  const [sun, setSun] = useState(false)
  const [sunAt, setSunAt] = useState('')
  const { busy, run, line } = useStep()
  const send = () =>
    run(
      'Preparo il modello…',
      async () => {
        await startRender(sceneId, capture.id, await exportGlb(), sun ? sunAt : '')
        await onSent()
      },
      'In coda: la foto compare qui sotto quando è pronta.',
    )
  return (
    <div className="flex flex-col gap-3">
      <span className="-mb-1 font-medium text-muted-foreground text-xs">Luce</span>
      <SegmentedControl
        onChange={(value) => setSun(value === 'sun')}
        options={[
          { label: 'Luce neutra', value: 'neutral' },
          { label: 'Sole reale', value: 'sun' },
        ]}
        value={sun ? 'sun' : 'neutral'}
      />
      {sun && (
        <label className="flex flex-col gap-1 text-muted-foreground text-xs">
          Giorno e ora, nel luogo del progetto
          <input
            className="rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-foreground text-sm [color-scheme:dark] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            onChange={(event) => setSunAt(event.target.value)}
            type="datetime-local"
            value={sunAt}
          />
        </label>
      )}
      <button className={PRIMARY} disabled={busy || (sun && !sunAt)} onClick={send} type="button">
        Foto realistica
      </button>
      {sun && !sunAt && !busy && (
        <p className="text-muted-foreground text-xs">Scegli giorno e ora per il sole.</p>
      )}
      {line}
    </div>
  )
}

type FormProps = { sceneId: string; capture: SavedCapture; onSent: () => Promise<void> }

/**
 * Foto: capture the view, then make it a photo with Antigravity (a brief and references) or Blender
 * (the same camera, real sun if wanted). Every photo of the project appears below by itself.
 */
export default function FotoPanel() {
  const projectId = useViewer((s) => s.projectId)
  const sceneId = typeof window === 'undefined' ? null : sceneIdFromPath(window.location.pathname)
  const [capture, setCapture] = useState<SavedCapture | null>(null)
  const [route, setRoute] = useState<Route>('antigravity')
  const [viewing, setViewing] = useState<number | null>(null)
  const { busy, run, line } = useStep()

  useEffect(() => {
    if (sceneId) latestCapture(sceneId).then(setCapture, () => setCapture(null))
  }, [sceneId])

  const requests = usePolling(
    useCallback(() => (sceneId ? listRequests(sceneId) : Promise.resolve([])), [sceneId]),
  )
  const renders = usePolling(
    useCallback(() => (sceneId ? listRenders(sceneId) : Promise.resolve([])), [sceneId]),
  )
  const tiles = [...requests.items.flatMap(requestTiles), ...renders.items.map(renderTile)]
  const loadError = requests.error ?? renders.error

  const take = () =>
    run('Catturo la vista…', async () => {
      if (projectId && sceneId) setCapture(await captureView(projectId, sceneId))
    })
  const retry = ({ capture: from, sunAt }: { capture: string; sunAt: string }) =>
    run('Preparo il modello…', async () => {
      if (!sceneId) return
      await startRender(sceneId, from, await exportGlb(), sunAt)
      await renders.refresh()
    })

  if (!sceneId) return null
  return (
    <div className="flex flex-col gap-4 p-4 text-sidebar-foreground">
      <h2 className="font-semibold text-base">Foto</h2>

      {capture ? (
        <figure className="relative overflow-hidden rounded-md ring-1 ring-border/50">
          <button
            aria-label="Apri la vista catturata a tutto schermo"
            className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setViewing(0)}
            type="button"
          >
            <img
              alt=""
              className="aspect-video w-full object-cover"
              src={thumbnailUrl(sceneId, capture.image, 768)}
            />
          </button>
          {capture.captured_at && (
            <figcaption className="absolute bottom-2 left-2 rounded-md bg-background/85 px-2 py-1 text-xs tabular-nums shadow-sm backdrop-blur-sm">
              Catturata {when(capture.captured_at)}
            </figcaption>
          )}
          <button
            className="absolute right-2 bottom-2 rounded-md bg-background/85 px-2.5 py-1 font-medium text-xs shadow-sm backdrop-blur-sm hover:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            disabled={!projectId || busy}
            onClick={take}
            type="button"
          >
            Cattura di nuovo
          </button>
        </figure>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-md border border-border/60 border-dashed p-4 text-center">
          <p className="text-muted-foreground text-xs">
            Inquadra la stanza nel 3D come la vuoi in foto, poi cattura.
          </p>
          <button className={PRIMARY} disabled={!projectId || busy} onClick={take} type="button">
            Cattura la vista
          </button>
        </div>
      )}
      {line}

      {capture && (
        <section aria-label="Fai la foto" className="flex flex-col gap-3">
          <SegmentedControl onChange={setRoute} options={ROUTES} value={route} />
          {/* both stay mounted, so a switch keeps the brief, references and light */}
          <div hidden={route !== 'antigravity'}>
            <AntigravityForm capture={capture} onSent={requests.refresh} sceneId={sceneId} />
          </div>
          <div hidden={route !== 'blender'}>
            <BlenderForm capture={capture} onSent={renders.refresh} sceneId={sceneId} />
          </div>
        </section>
      )}
      {capture && (
        <Viewer
          index={viewing}
          items={[
            {
              src: thumbnailUrl(sceneId, capture.image, 1920),
              alt: 'La vista catturata',
              caption: capture.captured_at
                ? `Catturata ${when(capture.captured_at)}`
                : 'Vista catturata',
            },
          ]}
          onIndex={setViewing}
        />
      )}

      {loadError && <p className="text-destructive text-xs">{loadError}</p>}
      <Gallery onRetry={retry} sceneId={sceneId} tiles={tiles} />
    </div>
  )
}
