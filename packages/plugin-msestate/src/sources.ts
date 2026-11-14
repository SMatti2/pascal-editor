import { projectApi, replyOf } from './http'

/** A project image under `sources/`, as our server lists it. */
export type SourceImage = { id: string; name: string; path: string; relative: string }

/** Photos of the place as it is. */
export const PLACE = 'photos/'
/** Images that guide the design: mood and products; each in exactly one group below. */
const REFS = 'refs/'
export const INSPIRATION = 'refs/ispirazione/'
export const PRODUCTS = 'refs/prodotti/'

/** The project's images (PNG, JPEG, WebP) under `sources/<prefix>`. */
export async function listSourceImages(sceneId: string, prefix: string): Promise<SourceImage[]> {
  const response = await fetch(`${projectApi(sceneId)}/sources?images=1`, { cache: 'no-store' })
  const { entries } = await replyOf<{ entries: SourceImage[] }>(
    response,
    'Immagini non disponibili',
  )
  return entries.filter((entry) => entry.relative.startsWith(prefix))
}

export const listReferenceImages = (sceneId: string) => listSourceImages(sceneId, REFS)

/** The references in their groups; any not yet sorted into a group stays visible as such. */
export function referenceGroups(images: SourceImage[]) {
  const under = (prefix: string) => (image: SourceImage) => image.relative.startsWith(prefix)
  return {
    inspiration: images.filter(under(INSPIRATION)),
    products: images.filter(under(PRODUCTS)),
    unsorted: images.filter((image) => !under(INSPIRATION)(image) && !under(PRODUCTS)(image)),
  }
}

/**
 * Upload one image into `sources/<folder>` (inspiration by default); the server keeps the original
 * bytes and names collisions `x (2).png`.
 */
export async function uploadSourceImage(
  sceneId: string,
  file: File,
  folder: string = INSPIRATION,
): Promise<SourceImage> {
  const body = new FormData()
  body.append('path', folder.replace(/\/$/, ''))
  body.append('operation_id', crypto.randomUUID())
  body.append('file', file, file.name)
  const response = await fetch(`${projectApi(sceneId)}/sources/upload`, { method: 'POST', body })
  return (await replyOf<{ file: SourceImage }>(response, 'Caricamento non riuscito')).file
}
