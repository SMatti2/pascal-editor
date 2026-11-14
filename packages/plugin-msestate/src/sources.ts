import { projectApi, replyOf } from './http'

/** A project image under `sources/`, as our server lists it. */
export type SourceImage = { id: string; name: string; path: string; relative: string }

/** Photos of the place as it is: heavy, kept out of git and of publish. */
export const PLACE = 'photos/'
/**
 * Chosen images, kept in git as decisions, each in exactly one group: details of the place kept or
 * copied, mood, and products and finishes that will be installed.
 */
const REFS = 'refs/'
export const EXISTING = 'refs/esistente/'
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

/**
 * The chosen images in their groups; any not yet sorted stays visible as such. The place's details
 * show with the place, not among the references.
 */
export function referenceGroups(images: SourceImage[]) {
  const under = (prefix: string) => (image: SourceImage) => image.relative.startsWith(prefix)
  const grouped = [EXISTING, INSPIRATION, PRODUCTS]
  return {
    existing: images.filter(under(EXISTING)),
    inspiration: images.filter(under(INSPIRATION)),
    products: images.filter(under(PRODUCTS)),
    unsorted: images.filter((image) => !grouped.some((prefix) => under(prefix)(image))),
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
