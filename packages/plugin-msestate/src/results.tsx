import { useState } from 'react'
import type { CyclesRender } from './cycles'
import { thumbnailUrl } from './http'
import type { RenderRequest } from './requests'
import { Viewer } from './viewer'

type Status = 'waiting' | 'queued' | 'running' | 'done' | 'failed'

/** One picture in the gallery, or the place one will land: from Antigravity or from Blender. */
export type Tile = {
  key: string
  via: 'Antigravity' | 'Blender'
  when: string
  status: Status
  image?: string
  /** What made it in a few words, under the photo: the light, or the start of the brief. */
  summary: string
  /** What made it in full, for the tooltip: brief, light, size. */
  details: string
  error?: string
  /** A failed Blender render can run again from the same capture and light. */
  retry?: { capture: string; sunAt: string }
}

const STATUS: Record<Exclude<Status, 'done'>, string> = {
  waiting: 'In attesa di Antigravity',
  queued: 'In coda',
  running: 'In corso…',
  failed: 'Non riuscita',
}

const day = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

export function requestTiles(request: RenderRequest): Tile[] {
  const brief = request.appearance || 'Nessuna indicazione di aspetto'
  const summary = brief.length > 40 ? `${brief.slice(0, 39)}…` : brief
  const base = { via: 'Antigravity' as const, when: request.created_at, summary, details: brief }
  if (request.results.length === 0) return [{ ...base, key: request.id, status: 'waiting' }]
  return request.results.map((image) => ({ ...base, key: image, status: 'done', image }))
}

export function renderTile(render: CyclesRender): Tile {
  const light = render.sun_at ? `sole del ${render.sun_at.replace('T', ' alle ')}` : 'luce neutra'
  return {
    key: render.id,
    via: 'Blender',
    when: render.created_at,
    status: render.status,
    image: render.result ?? undefined,
    summary: light,
    details: `${light} · ${render.width}×${render.height}`,
    error: render.error,
    retry:
      render.status === 'failed'
        ? { capture: render.capture, sunAt: render.sun_at ?? '' }
        : undefined,
  }
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function TileView({
  sceneId,
  tile,
  large,
  onOpen,
  onRetry,
}: {
  sceneId: string
  tile: Tile
  large: boolean
  onOpen: () => void
  onRetry: (retry: NonNullable<Tile['retry']>) => void
}) {
  return (
    <figure className="flex flex-col gap-1" title={tile.details}>
      {tile.image ? (
        <button
          aria-label={`Apri a tutto schermo: foto ${tile.via}, ${day(tile.when)}`}
          className={`block overflow-hidden rounded-md ring-1 ring-border/50 hover:ring-border ${FOCUS}`}
          onClick={onOpen}
          type="button"
        >
          <img
            alt=""
            className="aspect-video w-full object-cover"
            src={thumbnailUrl(sceneId, tile.image, large ? 768 : 384)}
          />
        </button>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-md border border-border/60 border-dashed p-2 text-center text-muted-foreground text-xs">
          <span className={tile.status === 'failed' ? 'text-destructive' : ''}>
            {STATUS[tile.status as Exclude<Status, 'done'>]}
          </span>
          {tile.retry && (
            <button
              className={`rounded px-2 py-0.5 font-medium text-foreground hover:bg-accent/50 ${FOCUS}`}
              onClick={() => tile.retry && onRetry(tile.retry)}
              title={tile.error}
              type="button"
            >
              Riprova
            </button>
          )}
        </div>
      )}
      <figcaption className="flex flex-col text-xs leading-4">
        <span className="truncate">{tile.summary}</span>
        <span className="flex justify-between gap-2 text-muted-foreground tabular-nums">
          <span>{tile.via}</span>
          <span>{day(tile.when)}</span>
        </span>
      </figcaption>
    </figure>
  )
}

/** Every photo of the project, newest first: the newest large, the rest two by two; any opens full screen. */
export function Gallery({
  sceneId,
  tiles,
  onRetry,
}: {
  sceneId: string
  tiles: Tile[]
  onRetry: (retry: NonNullable<Tile['retry']>) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const sorted = [...tiles].sort((a, b) => (a.when < b.when ? 1 : -1))
  const photos = sorted.filter((tile) => tile.image)
  const items = photos.map((tile) => ({
    src: thumbnailUrl(sceneId, tile.image as string, 1920),
    alt: `Foto ${tile.via}, ${day(tile.when)}`,
    caption: `${tile.via} · ${tile.summary} · ${day(tile.when)}`,
  }))
  const view = (tile: Tile) => (
    <TileView
      key={tile.key}
      large={tile === sorted[0]}
      onOpen={() => setOpen(photos.indexOf(tile))}
      onRetry={onRetry}
      sceneId={sceneId}
      tile={tile}
    />
  )
  const [first, ...rest] = sorted
  if (!first) return null
  return (
    <section aria-label="Foto fatte" className="flex flex-col gap-3">
      <h3 className="font-medium text-muted-foreground text-xs">Foto fatte</h3>
      {view(first)}
      {rest.length > 0 && <div className="grid grid-cols-2 gap-2">{rest.map(view)}</div>}
      <Viewer index={open} items={items} onIndex={setOpen} />
    </section>
  )
}
