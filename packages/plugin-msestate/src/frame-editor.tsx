'use client'

import { type CameraPose, emitter, type SnapshotFrameCamera } from '@pascal-app/core'
import { cameraPoseStore } from '@pascal-app/viewer/ui'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { type Aim, fitFov, frameIn, type Move, moved, quaternionOf, targetOf } from './camera'
import { PRIMARY, SMALL } from './ui'
import { fovOf, LENSES, lensOf, poseOf, type View } from './views'

/* Editing a view's framing in the 3D viewport: the camera goes to the view, the view's frame is
   drawn over the viewport with the model around it dimmed, and what is inside is what Salva
   shoots. Leaving, by Salva, Annulla or closing the panel, puts the viewport back. */

const MOVE_M = 0.2
const LIFT_M = 0.1
const TURN_DEG = 2

const MOVES: { label: string; title: string; move: Move }[][] = [
  [
    { label: 'Avanti', title: `Avanti di ${MOVE_M * 100} cm`, move: { forward: MOVE_M } },
    { label: 'Indietro', title: `Indietro di ${MOVE_M * 100} cm`, move: { forward: -MOVE_M } },
    { label: 'Sinistra', title: `A sinistra di ${MOVE_M * 100} cm`, move: { right: -MOVE_M } },
    { label: 'Destra', title: `A destra di ${MOVE_M * 100} cm`, move: { right: MOVE_M } },
  ],
  [
    { label: 'Su', title: `Più in alto di ${LIFT_M * 100} cm`, move: { up: LIFT_M } },
    { label: 'Giù', title: `Più in basso di ${LIFT_M * 100} cm`, move: { up: -LIFT_M } },
    { label: 'Ruota ⟲', title: `Ruota a sinistra di ${TURN_DEG}°`, move: { turnLeft: TURN_DEG } },
    { label: 'Ruota ⟳', title: `Ruota a destra di ${TURN_DEG}°`, move: { turnLeft: -TURN_DEG } },
  ],
  [
    {
      label: 'Inclina su',
      title: `Guarda più in alto di ${TURN_DEG}°`,
      move: { tiltUp: TURN_DEG },
    },
    {
      label: 'Inclina giù',
      title: `Guarda più in basso di ${TURN_DEG}°`,
      move: { tiltUp: -TURN_DEG },
    },
  ],
]

/** The 3D viewport's canvas: the largest one on the page. */
function viewportCanvas(): HTMLCanvasElement | null {
  let largest: HTMLCanvasElement | null = null
  let area = 0
  for (const canvas of document.querySelectorAll('canvas')) {
    const { width, height } = canvas.getBoundingClientRect()
    if (width * height > area) [largest, area] = [canvas, width * height]
  }
  return largest
}

/** The viewport's place on screen, kept up to date as the window and panels resize. */
function useViewportRect() {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    const canvas = viewportCanvas()
    if (!canvas) return
    const measure = () => setRect(canvas.getBoundingClientRect())
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  return rect
}

/** The viewport camera as the editor publishes it after each move. */
const useLivePose = () =>
  useSyncExternalStore(
    (onChange) => cameraPoseStore.subscribe(onChange),
    () => cameraPoseStore.getState().pose,
  )

const applyPose = (pose: CameraPose) => emitter.emit('camera-controls:apply-pose', pose)

/** The view's frame over the viewport; the model outside it dimmed. Clicks pass through. */
function FrameOverlay({
  rect,
  fov,
  aspect,
  label,
}: {
  rect: DOMRect
  fov: number
  aspect: number
  label: string
}) {
  const pose = useLivePose()
  if (!pose?.fov) return null
  const frame = frameIn(fov, aspect, pose.fov, rect)
  return createPortal(
    <div
      className="pointer-events-none fixed z-40 overflow-hidden"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <div
        className="absolute outline outline-2 outline-white"
        style={{ ...frame, boxShadow: '0 0 0 100vmax rgb(0 0 0 / 0.6)' }}
      >
        <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-white text-xs">
          {label}
        </span>
      </div>
    </div>,
    document.body,
  )
}

export function FrameEditor({
  view,
  busy,
  onSave,
  onCancel,
}: {
  view: View
  busy: boolean
  onSave: (camera: SnapshotFrameCamera) => void
  onCancel: () => void
}) {
  const rect = useViewportRect()
  const [lens, setLens] = useState(() => lensOf(view))
  const aspect = view.width / view.height
  const shotFov = fovOf(lens, view)
  // The aim last sent and the published pose then: until the editor publishes another (the user
  // orbiting, or our move settled), the next step starts from the aim sent.
  const sent = useRef<{ aim: Aim; seen: CameraPose | null } | null>(null)

  const aimNow = (): Aim => {
    const live = cameraPoseStore.getState().pose
    if (sent.current && (!live || live === sent.current.seen)) return sent.current.aim
    if (!live) throw new Error('L’editor non ha pubblicato la camera')
    return { position: live.position, target: live.target }
  }
  const viewFov = (fov: number) => {
    const canvas = viewportCanvas()?.getBoundingClientRect()
    return canvas ? fitFov(fov, aspect, canvas) : fov
  }
  const aimTo = (aim: Aim, fov: number) => {
    sent.current = { aim, seen: cameraPoseStore.getState().pose }
    applyPose({ ...aim, projection: 'perspective', fov: viewFov(fov) })
  }

  // Entering puts the camera on the view; leaving puts back the viewport the user had.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per edit, on the view as opened
  useEffect(() => {
    const before = cameraPoseStore.getState().pose
    const { position, quaternion, fov } = poseOf(view.camera)
    aimTo({ position, target: targetOf(position, quaternion) }, fov)
    return () => {
      if (before) applyPose(before)
    }
  }, [view.id])

  const changeLens = (mm: number) => {
    setLens(mm)
    aimTo(aimNow(), fovOf(mm, view))
  }
  const save = () => {
    const aim = aimNow()
    onSave({
      projection: 'perspective',
      position: aim.position,
      quaternion: quaternionOf(aim),
      fov: shotFov,
    })
  }

  const mm = Math.round(lens)
  return (
    <div className="flex flex-col gap-2 rounded-md bg-accent/30 p-2 text-xs">
      <p className="text-muted-foreground">
        Muovi il 3D come sempre o con i pulsanti: la foto è ciò che sta nel riquadro.
      </p>
      <label className="flex items-center gap-2">
        <span className="shrink-0 tabular-nums">Obiettivo {mm} mm</span>
        <input
          aria-label="Obiettivo in millimetri"
          className="min-w-0 flex-1"
          list="msestate-lenses"
          max={LENSES.at(-1)}
          min={LENSES[0]}
          onChange={(event) => changeLens(Number(event.target.value))}
          step={1}
          type="range"
          value={mm}
        />
        <datalist id="msestate-lenses">
          {LENSES.map((lens) => (
            <option key={lens} value={lens} />
          ))}
        </datalist>
      </label>
      {MOVES.map((row) => (
        <div className="flex flex-wrap gap-1" key={row[0]?.label}>
          {row.map(({ label, title, move }) => (
            <button
              className={`${SMALL} bg-background/60`}
              key={label}
              onClick={() => aimTo(moved(aimNow(), move), shotFov)}
              title={title}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <button className={PRIMARY} disabled={busy} onClick={save} type="button">
          Salva
        </button>
        <button className={SMALL} disabled={busy} onClick={onCancel} type="button">
          Annulla
        </button>
      </div>
      {rect && (
        <FrameOverlay aspect={aspect} fov={shotFov} label={`${view.name} · ${mm} mm`} rect={rect} />
      )}
    </div>
  )
}
