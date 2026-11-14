'use client'

import { useScene } from '@pascal-app/core'
import { useCallback, useEffect, useState } from 'react'
import { sceneHash } from './capture'
import { errorMessage, thumbnailUrl } from './http'
import { FIELD, FOCUS, PRIMARY, SMALL, when } from './ui'
import { useStep } from './use-step'
import { Viewer } from './viewer'
import {
  addView,
  changeLens,
  changeView,
  goToView,
  lensOf,
  listViews,
  nextLens,
  reframeView,
  shootViews,
  type View,
} from './views'

const HASH_DELAY_MS = 800 // the scene is hashed once edits pause, not on every change

/** The project's views, loaded once and replaced by each change's answer. */
export function useViews(sceneId: string) {
  const [views, setViews] = useState<View[]>([])
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(
    () =>
      listViews(sceneId).then(
        (list) => {
          setViews(list)
          setError(null)
        },
        (failure) => setError(errorMessage(failure)),
      ),
    [sceneId],
  )
  useEffect(() => {
    void reload()
  }, [reload])
  return { views, setViews, error }
}

/** The hash of the scene as it is now, as a capture stamps it; null until first computed. */
export function useSceneHash() {
  const nodes = useScene((state) => state.nodes)
  const [hash, setHash] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      sceneHash(nodes).then((value) => live && setHash(value))
    }, HASH_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [nodes])
  return hash
}

/** The views whose latest shot shows an older scene than `hash`; none while the hash is unknown. */
export const staleViews = (views: View[], hash: string | null) =>
  views.filter((view) => hash !== null && view.scene_sha256 !== hash)

type Props = {
  projectId: string | null
  sceneId: string
  hash: string | null
  views: View[]
  onViews: (views: View[]) => void
  onPhoto: (view: View) => void
}

function ViewCard({
  sceneId,
  view,
  stale,
  busy,
  onReframe,
  onRename,
  onDelete,
  onPhoto,
  onOpen,
  onLens,
}: {
  sceneId: string
  view: View
  stale: boolean
  busy: boolean
  onReframe: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onPhoto: () => void
  onOpen: () => void
  onLens: (mm: number) => void
}) {
  const [name, setName] = useState(view.name)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => setName(view.name), [view.name])
  const rename = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== view.name) onRename(trimmed)
    else setName(view.name)
  }
  return (
    <figure className="flex flex-col gap-1.5">
      <button
        aria-label={`Apri a tutto schermo: ${view.name}`}
        className={`relative block cursor-zoom-in overflow-hidden rounded-md ring-1 ring-border/50 hover:ring-border ${FOCUS}`}
        onClick={onOpen}
        type="button"
      >
        <img
          alt=""
          className="w-full object-cover"
          src={thumbnailUrl(sceneId, view.image, 768)}
          style={{ aspectRatio: `${view.width} / ${view.height}` }}
        />
        {stale && (
          <span className="absolute top-2 left-2 rounded-md bg-amber-500/90 px-2 py-0.5 font-medium text-black text-xs">
            Da aggiornare
          </span>
        )}
      </button>
      <figcaption className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            aria-label="Nome della vista"
            className={`min-w-0 flex-1 ${FIELD} py-1`}
            maxLength={80}
            onBlur={rename}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            value={name}
          />
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {when(view.captured_at)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground tabular-nums">
            Obiettivo {Math.round(lensOf(view))} mm
          </span>
          {([-1, 1] as const).map((by) => {
            const mm = nextLens(view, by)
            return (
              <button
                className={SMALL}
                disabled={busy || mm === null}
                key={by}
                onClick={() => mm !== null && onLens(mm)}
                title={mm === null ? undefined : `Rifai la vista con un ${mm} mm`}
                type="button"
              >
                {by < 0 ? 'Più largo' : 'Più stretto'}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-1">
          <button className={SMALL} disabled={busy} onClick={() => goToView(view)} type="button">
            Vai alla vista
          </button>
          <button
            className={SMALL}
            disabled={busy}
            onClick={onReframe}
            title="Usa l’inquadratura che vedi adesso nel 3D"
            type="button"
          >
            Nuova inquadratura
          </button>
          <button className={SMALL} disabled={busy} onClick={onPhoto} type="button">
            Foto realistica
          </button>
          <button
            className={`${SMALL} ${deleting ? 'text-destructive' : 'text-muted-foreground'}`}
            disabled={busy}
            onBlur={() => setDeleting(false)}
            onClick={() => (deleting ? onDelete() : setDeleting(true))}
            type="button"
          >
            {deleting ? 'Conferma elimina' : 'Elimina'}
          </button>
        </div>
      </figcaption>
    </figure>
  )
}

/**
 * Viste: named cameras on the model. Each keeps its latest shot; when the model changes it is
 * marked out of date, and one button shoots those again from their own cameras.
 */
export function ViewsTab({ projectId, sceneId, hash, views, onViews, onPhoto }: Props) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const { busy, run, line } = useStep()
  const stale = staleViews(views, hash)
  const act = (label: string, work: () => Promise<View[]>, done?: string) =>
    run(label, async () => onViews(await work()), done)

  const add = () =>
    projectId &&
    act('Salvo la vista…', async () => {
      const after = await addView(projectId, sceneId, name)
      setName('')
      return after
    })

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <p className="text-muted-foreground text-xs">
          Inquadra nel 3D, in prospettiva, poi salva la vista con un nome.
        </p>
        <div className="flex gap-2">
          <input
            aria-label="Nome della nuova vista"
            className={`min-w-0 flex-1 ${FIELD}`}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Es. Soggiorno dall’ingresso"
            value={name}
          />
          <button className={PRIMARY} disabled={!projectId || busy || !name.trim()} type="submit">
            Salva vista
          </button>
        </div>
      </form>

      {stale.length > 0 && (
        <button
          className={PRIMARY}
          disabled={!projectId || busy}
          onClick={() =>
            projectId &&
            act(
              'Rifaccio le viste…',
              () => shootViews(projectId, sceneId, stale),
              'Viste aggiornate.',
            )
          }
          type="button"
        >
          Rifai {stale.length === 1 ? 'la vista' : `le ${stale.length} viste`} da aggiornare
        </button>
      )}
      {line}

      {views.map((view, index) => (
        <ViewCard
          busy={busy}
          key={view.id}
          onDelete={() =>
            act('Elimino…', () => changeView(sceneId, { action: 'delete', id: view.id }))
          }
          onLens={(mm) =>
            projectId &&
            act(`Rifaccio la vista con un ${mm} mm…`, () =>
              changeLens(projectId, sceneId, view, mm),
            )
          }
          onOpen={() => setOpen(index)}
          onPhoto={() => onPhoto(view)}
          onReframe={() =>
            projectId && act('Salvo l’inquadratura…', () => reframeView(projectId, sceneId, view))
          }
          onRename={(next) =>
            act('Rinomino…', () =>
              changeView(sceneId, { action: 'rename', id: view.id, name: next }),
            )
          }
          sceneId={sceneId}
          stale={stale.includes(view)}
          view={view}
        />
      ))}
      {views.length === 0 && (
        <p className="text-muted-foreground text-xs">Nessuna vista salvata.</p>
      )}
      <Viewer
        index={open}
        items={views.map((view) => ({
          src: thumbnailUrl(sceneId, view.image, 1920),
          alt: view.name,
          caption: `${view.name} · ${when(view.captured_at)}`,
        }))}
        onIndex={setOpen}
      />
    </div>
  )
}
