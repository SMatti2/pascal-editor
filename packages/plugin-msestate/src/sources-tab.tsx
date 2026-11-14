'use client'

import { Loader2, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { errorMessage, thumbnailUrl } from './http'
import {
  INSPIRATION,
  listSourceImages,
  PLACE,
  PRODUCTS,
  referenceGroups,
  type SourceImage,
  uploadSourceImage,
} from './sources'
import { FOCUS } from './ui'
import { Viewer } from './viewer'

/** One group of project images, three per row; any opens full screen; `folder` adds an upload. */
function Shelf({
  sceneId,
  title,
  images,
  folder,
  onUploaded,
}: {
  sceneId: string
  title: string
  images: SourceImage[]
  folder?: string
  onUploaded: () => Promise<void>
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const upload = async (file: File | undefined) => {
    if (!file || !folder) return
    setUploading(true)
    try {
      await uploadSourceImage(sceneId, file, folder)
      await onUploaded()
      setError(null)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setUploading(false)
    }
  }
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="flex justify-between font-medium text-muted-foreground text-xs">
        <span>{title}</span>
        <span className="tabular-nums">{images.length}</span>
      </h3>
      <div className="grid grid-cols-3 gap-1.5">
        {images.map((image, index) => (
          <button
            aria-label={`Apri ${image.name}`}
            className={`overflow-hidden rounded-md ring-1 ring-border/50 hover:ring-border ${FOCUS}`}
            key={image.relative}
            onClick={() => setOpen(index)}
            title={image.relative}
            type="button"
          >
            <img
              alt=""
              className="aspect-square w-full object-cover"
              src={thumbnailUrl(sceneId, image.path, 192)}
            />
          </button>
        ))}
        {folder && (
          <label
            className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border border-border/60 border-dashed text-muted-foreground text-xs focus-within:ring-2 focus-within:ring-ring hover:text-foreground"
            title="Carica un’immagine (PNG, JPEG, WebP)"
          >
            {uploading ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Plus aria-hidden className="size-4" />
            )}
            <span>{uploading ? 'Carico' : 'Carica'}</span>
            <input
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => upload(event.target.files?.[0])}
              type="file"
            />
          </label>
        )}
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <Viewer
        index={open}
        items={images.map((image) => ({
          src: thumbnailUrl(sceneId, image.path, 1920),
          alt: image.name,
          caption: image.relative,
        }))}
        onIndex={setOpen}
      />
    </section>
  )
}

/** The images under `sources/<prefix>`, reloaded on demand (after an upload). */
function useSourceImages(sceneId: string, prefix: string) {
  const [images, setImages] = useState<SourceImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(
    () =>
      listSourceImages(sceneId, prefix).then(
        (list) => {
          setImages(list)
          setError(null)
        },
        (failure) => setError(errorMessage(failure)),
      ),
    [sceneId, prefix],
  )
  useEffect(() => {
    void reload()
  }, [reload])
  return { images, error, reload }
}

/** Luogo: the photos of the place as it is (`sources/photos/`). */
export function PlaceTab({ sceneId }: { sceneId: string }) {
  const { images, error, reload } = useSourceImages(sceneId, PLACE)
  return (
    <div className="flex flex-col gap-3">
      <Shelf
        folder={PLACE}
        images={images}
        onUploaded={reload}
        sceneId={sceneId}
        title="Foto del luogo"
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

/** Riferimenti: inspiration, and the products and finishes that will really be installed. */
export function ReferencesTab({ sceneId }: { sceneId: string }) {
  const { images, error, reload } = useSourceImages(sceneId, 'refs/')
  const { inspiration, products, unsorted } = referenceGroups(images)
  return (
    <div className="flex flex-col gap-5">
      <Shelf
        folder={INSPIRATION}
        images={inspiration}
        onUploaded={reload}
        sceneId={sceneId}
        title="Ispirazione"
      />
      <Shelf
        folder={PRODUCTS}
        images={products}
        onUploaded={reload}
        sceneId={sceneId}
        title="Prodotti e finiture da posare"
      />
      {unsorted.length > 0 && (
        <Shelf images={unsorted} onUploaded={reload} sceneId={sceneId} title="Da smistare" />
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
