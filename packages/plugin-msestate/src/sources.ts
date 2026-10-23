import { projectApi, replyOf } from './http'

/** A project image under `sources/`, as our server lists it. */
export type SourceImage = { id: string; name: string; path: string; relative: string }

/** Reference images live under `sources/refs/`; uploads join Studio's appearance folder. */
const REFS = 'refs/'
const UPLOAD_FOLDER = 'refs/aspetto'

export async function listReferenceImages(sceneId: string): Promise<SourceImage[]> {
  const response = await fetch(`${projectApi(sceneId)}/sources?images=1`, { cache: 'no-store' })
  const { entries } = await replyOf<{ entries: SourceImage[] }>(
    response,
    'Immagini non disponibili',
  )
  return entries.filter((entry) => entry.relative.startsWith(REFS))
}

/** Upload one reference; the server keeps the original bytes and names collisions `x (2).png`. */
export async function uploadReference(sceneId: string, file: File): Promise<SourceImage> {
  const body = new FormData()
  body.append('path', UPLOAD_FOLDER)
  body.append('operation_id', crypto.randomUUID())
  body.append('file', file, file.name)
  const response = await fetch(`${projectApi(sceneId)}/sources/upload`, { method: 'POST', body })
  return (await replyOf<{ file: SourceImage }>(response, 'Caricamento non riuscito')).file
}
