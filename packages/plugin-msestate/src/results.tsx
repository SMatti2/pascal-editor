import { useState } from 'react'
import { thumbnailUrl } from './http'
import type { RenderRequest } from './requests'
import { FOCUS, when } from './ui'
import { Viewer } from './viewer'

/** One photo in the gallery, or the place one will land while Antigravity works on it. */
export type Tile = {
  key: string
  when: string
  image?: string
  /** The start of the brief, under the photo. */
  summary: string
  /** The brief in full, for the tooltip. */
  details: string
}

const SUMMARY_MAX = 40

export function requestTiles(request: RenderRequest): Tile[] {
  const brief = request.appearance || 'Nessuna indicazione di aspetto'
  const summary = brief.length > SUMMARY_MAX ? `${brief.slice(0, SUMMARY_MAX - 1)}…` : brief
  const base = { when: request.created_at, summary, details: brief }
  if (request.results.length === 0) return [{ ...base, key: request.id }]
  return request.results.map((image) => ({ ...base, key: image, image }))
}

function TileView({
  sceneId,
  tile,
  large,
  onOpen,
}: {
  sceneId: string
  tile: Tile
  large: boolean
  onOpen: () => void
}) {
  return (
    <figure className="flex flex-col gap-1" title={tile.details}>
      {tile.image ? (
        <button
          aria-label={`Apri a tutto schermo: foto del ${when(tile.when)}`}
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
        <div className="flex aspect-video items-center justify-center rounded-md border border-border/60 border-dashed p-2 text-center text-muted-foreground text-xs">
          In attesa di Antigravity
        </div>
      )}
      <figcaption className="flex justify-between gap-2 text-xs leading-4">
        <span className="truncate">{tile.summary}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{when(tile.when)}</span>
      </figcaption>
    </figure>
  )
}

/** Every photo of the project, newest first: the newest large, the rest two by two; any opens full screen. */
export function Gallery({ sceneId, tiles }: { sceneId: string; tiles: Tile[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const sorted = [...tiles].sort((a, b) => Date.parse(b.when) - Date.parse(a.when))
  const photos = sorted.filter((tile) => tile.image)
  const items = photos.map((tile) => ({
    src: thumbnailUrl(sceneId, tile.image as string, 1920),
    alt: `Foto del ${when(tile.when)}`,
    caption: `${tile.summary} · ${when(tile.when)}`,
  }))
  const view = (tile: Tile) => (
    <TileView
      key={tile.key}
      large={tile === sorted[0]}
      onOpen={() => setOpen(photos.indexOf(tile))}
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
