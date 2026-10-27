import type { CyclesRender } from './cycles'
import { thumbnailUrl } from './http'
import type { RenderRequest } from './requests'

type Status = 'waiting' | 'queued' | 'running' | 'done' | 'failed'

/** One picture in the gallery, or the place one will land: from Antigravity or from Blender. */
export type Tile = {
  key: string
  via: 'Antigravity' | 'Blender'
  when: string
  status: Status
  image?: string
  /** What made it, for the tooltip: brief, light, size. */
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
  const base = { via: 'Antigravity' as const, when: request.created_at, details: brief }
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
    details: `${light} · ${render.width}×${render.height}`,
    error: render.error,
    retry:
      render.status === 'failed'
        ? { capture: render.capture, sunAt: render.sun_at ?? '' }
        : undefined,
  }
}

function TileView({
  sceneId,
  tile,
  large,
  onRetry,
}: {
  sceneId: string
  tile: Tile
  large: boolean
  onRetry: (retry: NonNullable<Tile['retry']>) => void
}) {
  return (
    <figure className="flex flex-col gap-1" title={tile.details}>
      {tile.image ? (
        <a
          className="block overflow-hidden rounded-md ring-1 ring-border/50 focus-visible:ring-2 focus-visible:ring-ring"
          href={thumbnailUrl(sceneId, tile.image, 768)}
          rel="noreferrer"
          target="_blank"
        >
          <img
            alt={`Foto ${tile.via}, ${day(tile.when)}`}
            className="aspect-video w-full object-cover"
            src={thumbnailUrl(sceneId, tile.image, large ? 768 : 384)}
          />
        </a>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-md border border-border/60 border-dashed p-2 text-center text-muted-foreground text-xs">
          <span className={tile.status === 'failed' ? 'text-destructive' : ''}>
            {STATUS[tile.status as Exclude<Status, 'done'>]}
          </span>
          {tile.retry && (
            <button
              className="rounded px-2 py-0.5 font-medium text-foreground hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => tile.retry && onRetry(tile.retry)}
              title={tile.error}
              type="button"
            >
              Riprova
            </button>
          )}
        </div>
      )}
      <figcaption className="flex justify-between gap-2 text-muted-foreground text-xs tabular-nums">
        <span>{tile.via}</span>
        <span>{day(tile.when)}</span>
      </figcaption>
    </figure>
  )
}

/** Every photo of the project, newest first: the newest large, the rest two by two. */
export function Gallery({
  sceneId,
  tiles,
  onRetry,
}: {
  sceneId: string
  tiles: Tile[]
  onRetry: (retry: NonNullable<Tile['retry']>) => void
}) {
  const sorted = [...tiles].sort((a, b) => (a.when < b.when ? 1 : -1))
  const [first, ...rest] = sorted
  if (!first) return null
  return (
    <section aria-label="Foto fatte" className="flex flex-col gap-3">
      <h3 className="font-medium text-muted-foreground text-xs">Foto fatte</h3>
      <TileView large onRetry={onRetry} sceneId={sceneId} tile={first} />
      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {rest.map((tile) => (
            <TileView
              key={tile.key}
              large={false}
              onRetry={onRetry}
              sceneId={sceneId}
              tile={tile}
            />
          ))}
        </div>
      )}
    </section>
  )
}
