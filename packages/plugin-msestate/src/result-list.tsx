import type { CyclesRender } from './cycles'
import { thumbnailUrl } from './http'
import type { RenderRequest } from './requests'

/** One row of results: when, short notes, an optional text, and the images saved for it. */
export type ResultEntry = {
  id: string
  when: string
  notes: string[]
  text?: string
  images: { path: string; alt: string }[]
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const requestEntry = (request: RenderRequest): ResultEntry => ({
  id: request.id,
  when: request.created_at,
  notes: [
    ...(request.references.length
      ? [count(request.references.length, 'riferimento', 'riferimenti')]
      : []),
    ...(request.results.length ? [] : ['in attesa di Antigravity']),
  ],
  text: request.appearance || undefined,
  images: request.results.map((path, index) => ({ path, alt: `Tentativo ${index + 1}` })),
})

const STATUS: Record<CyclesRender['status'], string> = {
  queued: 'in coda',
  running: 'Blender al lavoro…',
  done: 'fatto',
  failed: 'non riuscito',
}

export const renderEntry = (render: CyclesRender): ResultEntry => ({
  id: render.id,
  when: render.created_at,
  notes: [`${render.width}×${render.height}`, `${render.samples} campioni`, STATUS[render.status]],
  text: render.error,
  images: render.result ? [{ path: render.result, alt: 'Render Cycles' }] : [],
})

/** Results, newest first; each image opens larger in a new tab. */
export function ResultList({ sceneId, entries }: { sceneId: string; entries: ResultEntry[] }) {
  if (entries.length === 0) return null
  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li className="flex flex-col gap-1" key={entry.id}>
          <p className="text-sidebar-foreground/60 text-xs">
            {[time(entry.when), entry.id.slice(0, 8), ...entry.notes].join(' · ')}
          </p>
          {entry.text && <p className="line-clamp-3 whitespace-pre-line text-xs">{entry.text}</p>}
          <div className="grid grid-cols-2 gap-1">
            {entry.images.map((image) => (
              <a
                href={thumbnailUrl(sceneId, image.path, 768)}
                key={image.path}
                rel="noreferrer"
                target="_blank"
              >
                <img
                  alt={image.alt}
                  className="aspect-video w-full rounded object-cover"
                  src={thumbnailUrl(sceneId, image.path, 384)}
                />
              </a>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
