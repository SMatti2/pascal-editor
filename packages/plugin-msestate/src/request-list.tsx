import { thumbnailUrl } from './http'
import type { RenderRequest } from './requests'

const time = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

/** Each request with its capture and Antigravity's numbered attempts, newest request first. */
export function RequestList({ sceneId, requests }: { sceneId: string; requests: RenderRequest[] }) {
  if (requests.length === 0) return null
  return (
    <ul className="flex flex-col gap-3">
      {requests.map((request) => (
        <li className="flex flex-col gap-1" key={request.id}>
          <p className="text-sidebar-foreground/60 text-xs">
            {time(request.created_at)} · {request.id.slice(0, 8)}
            {request.references.length > 0 &&
              ` · ${request.references.length} ${request.references.length === 1 ? 'riferimento' : 'riferimenti'}`}
            {request.results.length === 0 && ' · in attesa di Antigravity'}
          </p>
          {request.appearance && <p className="line-clamp-2 text-xs">{request.appearance}</p>}
          <div className="grid grid-cols-2 gap-1">
            {request.results.map((path, index) => (
              <a
                href={thumbnailUrl(sceneId, path, 768)}
                key={path}
                rel="noreferrer"
                target="_blank"
              >
                <img
                  alt={`Tentativo ${index + 1}`}
                  className="aspect-video w-full rounded object-cover"
                  src={thumbnailUrl(sceneId, path, 384)}
                />
              </a>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
