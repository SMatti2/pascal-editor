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

  return (
    <fieldset className="flex flex-col gap-2 text-xs">
      <legend className="mb-1">
        Riferimenti ({chosen.length}/{REFERENCES_MAX}): tocca per scegliere
      </legend>
      <div className="grid max-h-40 grid-cols-4 gap-1 overflow-y-auto">
        {images.map((image) => (
          <button
            aria-pressed={isChosen(image.relative)}
            className="rounded p-0.5 aria-pressed:bg-primary disabled:opacity-40"
            disabled={full && !isChosen(image.relative)}
            key={image.relative}
            onClick={() => toggle(image.relative)}
            title={image.relative}
            type="button"
          >
            <img
              alt={image.name}
              className="aspect-square w-full rounded object-cover"
              src={thumbnailUrl(sceneId, image.path, 192)}
            />
          </button>
        ))}
      </div>
      <label className="cursor-pointer text-sidebar-foreground/70 underline">
        {uploading ? 'Caricamento…' : 'Carica un’immagine (PNG, JPEG, WebP)'}
        <input
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={(event) => upload(event.target.files?.[0])}
          type="file"
        />
      </label>
      {chosen.map((ref) => (
        <div
          className="flex flex-col gap-1 rounded border border-sidebar-border p-2"
          key={ref.relative}
        >
          <span className="truncate">{ref.relative}</span>
          <select
            className="rounded bg-transparent"
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
              className="rounded border border-sidebar-border bg-transparent p-1"
              maxLength={200}
              onChange={(event) => update(ref.relative, { target: event.target.value })}
              placeholder="Dove applicarlo, es. pavimento della cucina"
              value={ref.target ?? ''}
            />
          )}
        </div>
      ))}
      {error && <p className="text-destructive">{error}</p>}
    </fieldset>
  )
}
