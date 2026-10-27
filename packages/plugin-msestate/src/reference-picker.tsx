import { Check, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorMessage, thumbnailUrl } from './http'
import type { ReferenceChoice } from './requests'
import { listReferenceImages, type SourceImage, uploadReference } from './sources'

export const REFERENCES_MAX = 8

type Props = {
  sceneId: string
  chosen: ReferenceChoice[]
  onChange: (chosen: ReferenceChoice[]) => void
}

/** Pick reference images from `sources/refs/` or upload one; each is mood or a material for a named target. */
export function ReferencePicker({ sceneId, chosen, onChange }: Props) {
  const [images, setImages] = useState<SourceImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    listReferenceImages(sceneId).then(setImages, (failure) => setError(errorMessage(failure)))
  }, [sceneId])

  const isChosen = (relative: string) => chosen.some((ref) => ref.relative === relative)
  const full = chosen.length >= REFERENCES_MAX
  const toggle = (relative: string) =>
    onChange(
      isChosen(relative)
        ? chosen.filter((ref) => ref.relative !== relative)
        : [...chosen, { relative, role: 'appearance' }],
    )
  const update = (relative: string, change: Partial<ReferenceChoice>) =>
    onChange(chosen.map((ref) => (ref.relative === relative ? { ...ref, ...change } : ref)))

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const image = await uploadReference(sceneId, file)
      setImages((list) => [...list.filter((i) => i.relative !== image.relative), image])
      if (!full) onChange([...chosen, { relative: image.relative, role: 'appearance' }])
      setError(null)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setUploading(false)
    }
  }

  const imageOf = (relative: string) => images.find((image) => image.relative === relative)

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex w-full justify-between font-medium text-muted-foreground text-xs">
        <span>Riferimenti</span>
        <span className="tabular-nums">
          {chosen.length}/{REFERENCES_MAX}
        </span>
      </legend>
      <div className="grid grid-cols-4 gap-1.5">
        {images.map((image) => {
          const on = isChosen(image.relative)
          return (
            <button
              aria-label={image.name}
              aria-pressed={on}
              className={`relative overflow-hidden rounded-md ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${on ? 'ring-2 ring-primary' : 'ring-border/50 hover:ring-border'}`}
              disabled={full && !on}
              key={image.relative}
              onClick={() => toggle(image.relative)}
              title={image.name}
              type="button"
            >
              <img
                alt=""
                className="aspect-square w-full object-cover"
                src={thumbnailUrl(sceneId, image.path, 192)}
              />
              {on && (
                <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check aria-hidden className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
        <label
          className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border border-border/60 border-dashed text-muted-foreground text-xs hover:text-foreground focus-within:ring-2 focus-within:ring-ring"
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
      </div>
      {chosen.map((ref) => {
        const image = imageOf(ref.relative)
        return (
          <div className="flex items-start gap-2" key={ref.relative}>
            {image && (
              <img
                alt=""
                className="size-9 shrink-0 rounded object-cover"
                src={thumbnailUrl(sceneId, image.path, 192)}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <select
                aria-label={`Uso di ${image?.name ?? ref.relative}`}
                className="rounded-md border border-border/60 bg-background/60 px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                onChange={(event) =>
                  update(ref.relative, { role: event.target.value as ReferenceChoice['role'] })
                }
                value={ref.role}
              >
                <option value="appearance">Atmosfera e finiture</option>
                <option value="material">Materiale per una superficie</option>
              </select>
              {ref.role === 'material' && (
                <input
                  aria-label="Dove applicarlo"
                  className="rounded-md border border-border/60 bg-background/60 px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  maxLength={200}
                  onChange={(event) => update(ref.relative, { target: event.target.value })}
                  placeholder="Dove, es. pavimento della cucina"
                  value={ref.target ?? ''}
                />
              )}
            </div>
          </div>
        )
      })}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </fieldset>
  )
}
