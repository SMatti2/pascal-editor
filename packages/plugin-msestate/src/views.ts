import { emitter, type SnapshotCapturePose, type SnapshotFrameCamera } from '@pascal-app/core'
import { type SavedCapture, saveCapture, stampScene } from './capture'
import { projectApi, replyOf } from './http'
import { hiddenLevels, requestFrame } from './view'

/**
 * A named camera on the model and its latest shot, as our server lists it: the camera, levels and
 * scene come from that shot's capture.
 */
export type View = {
  id: string
  name: string
  capture: string
  image: string
  camera: SnapshotFrameCamera
  hidden_levels: string[]
  width: number
  height: number
  scene_sha256: string
  captured_at: string
}

type Change =
  | { action: 'add'; name: string; capture: string }
  | { action: 'shoot'; id: string; capture: string }
  | { action: 'rename'; id: string; name: string }
  | { action: 'delete'; id: string }

export async function listViews(sceneId: string): Promise<View[]> {
  const response = await fetch(`${projectApi(sceneId)}/pascal/views`, { cache: 'no-store' })
  return (await replyOf<{ views: View[] }>(response, 'Viste non disponibili')).views
}

/** One change to the views; the server answers with all of them after it. */
export async function changeView(sceneId: string, change: Change): Promise<View[]> {
  const response = await fetch(`${projectApi(sceneId)}/pascal/views`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(change),
  })
  return (await replyOf<{ views: View[] }>(response, 'Vista non salvata')).views
}

/** The pose Pascal shoots a stored camera from; only a perspective camera has one. */
export function poseOf(camera: SnapshotFrameCamera): SnapshotCapturePose {
  if (camera.projection !== 'perspective' || !camera.fov)
    throw new Error('Passa alla vista prospettica per salvare la vista')
  return { position: camera.position, quaternion: camera.quaternion, fov: camera.fov }
}

/** The viewport's camera, read from a frame of what it shows now. */
async function viewportFrame(projectId: string) {
  const frame = await requestFrame(projectId)
  if (!frame.camera) throw new Error('L’editor non ha restituito la camera')
  poseOf(frame.camera)
  return frame as typeof frame & { camera: SnapshotFrameCamera }
}

/** The current viewport as a capture a view can stand on: perspective, with its camera. */
async function captureCurrent(projectId: string, sceneId: string): Promise<SavedCapture> {
  const scene = await stampScene(sceneId)
  const hidden = hiddenLevels()
  return saveCapture(await viewportFrame(projectId), scene, hidden)
}

/** A new view named `name` on what the viewport shows now. */
export async function addView(projectId: string, sceneId: string, name: string) {
  const capture = await captureCurrent(projectId, sceneId)
  return changeView(sceneId, { action: 'add', name, capture: capture.id })
}

/**
 * `view` shot from `camera` at the view's own size, on the model as it is now, without moving the
 * user's viewport; the view then stands on that shot.
 */
async function shootFrom(
  projectId: string,
  sceneId: string,
  view: View,
  camera: SnapshotFrameCamera,
  hidden: string[],
) {
  const scene = await stampScene(sceneId)
  const frame = await requestFrame(projectId, {
    pose: poseOf(camera),
    size: { w: view.width, h: view.height },
  })
  const capture = await saveCapture({ blob: frame.blob, camera }, scene, hidden)
  return changeView(sceneId, { action: 'shoot', id: view.id, capture: capture.id })
}

/**
 * A new angle for `view`: the viewport's camera now, shot at the view's own size so a reframed
 * view keeps its frame (the viewport's shape changes with the window).
 */
export async function reframeView(projectId: string, sceneId: string, view: View) {
  const hidden = hiddenLevels()
  const { camera } = await viewportFrame(projectId)
  return shootFrom(projectId, sceneId, view, camera, hidden)
}

/** `view` shot again from its own camera. */
const shootView = (projectId: string, sceneId: string, view: View) =>
  shootFrom(projectId, sceneId, view, view.camera, view.hidden_levels)

/* The lens, as a photographer names it: the full-frame focal length giving the view's horizontal
   angle. The camera keeps a vertical field of view; the shot's shape links the two. */
export const LENSES = [14, 16, 18, 20, 24, 28, 35, 50]
const HALF_SENSOR_MM = 18 // a full-frame sensor is 36 mm wide
const DEFAULT_FOV = 50 // the editor's perspective camera
const LENS_TOLERANCE_MM = 0.5 // a lens this close to the view's counts as the same

type Frame = Pick<View, 'width' | 'height'>
const aspectOf = (frame: Frame) => frame.width / frame.height

/** The view's lens in millimetres. */
export function lensOf(view: Frame & Pick<View, 'camera'>): number {
  const half = ((view.camera.fov ?? DEFAULT_FOV) * Math.PI) / 360
  return HALF_SENSOR_MM / (Math.tan(half) * aspectOf(view))
}

/** The vertical field of view, in degrees, that a `mm` lens gives at the view's shape. */
export function fovOf(mm: number, frame: Frame): number {
  return (360 / Math.PI) * Math.atan(HALF_SENSOR_MM / (mm * aspectOf(frame)))
}

/** The next lens in LENSES wider (−1) or narrower (+1) than the view's; null at the end of the list. */
export function nextLens(view: Frame & Pick<View, 'camera'>, by: -1 | 1): number | null {
  const mm = lensOf(view)
  const next =
    by < 0
      ? LENSES.filter((lens) => lens < mm - LENS_TOLERANCE_MM).at(-1)
      : LENSES.find((lens) => lens > mm + LENS_TOLERANCE_MM)
  return next ?? null
}

/** `view` shot again from the same place with a `mm` lens. */
export const changeLens = (projectId: string, sceneId: string, view: View, mm: number) =>
  shootFrom(projectId, sceneId, view, { ...view.camera, fov: fovOf(mm, view) }, view.hidden_levels)

const SESSION = 'msestate:viste'

/**
 * Every view in `views` shot again, one after the other, inside one capture session: the pictures
 * show the finished house and the user's viewport keeps its last frame. Returns the views after.
 */
export async function shootViews(projectId: string, sceneId: string, views: View[]) {
  let after: View[] = []
  emitter.emit('camera-controls:capture-session', { owner: SESSION, active: true })
  try {
    for (const view of views) after = await shootView(projectId, sceneId, view)
  } finally {
    emitter.emit('camera-controls:capture-session', { owner: SESSION, active: false })
  }
  return after
}

/** Show `view`'s camera in the viewport. */
export function goToView(view: View) {
  const { position, quaternion, fov } = poseOf(view.camera)
  emitter.emit('camera-controls:apply-pose', {
    position,
    target: targetOf(position, quaternion),
    projection: 'perspective',
    fov,
  })
}

/** A point 1 m ahead of the camera: three.js cameras look down their local −Z. */
export function targetOf(
  [x, y, z]: [number, number, number],
  [qx, qy, qz, qw]: [number, number, number, number],
): [number, number, number] {
  // −Z rotated by the quaternion
  const fx = -2 * (qx * qz + qw * qy)
  const fy = -2 * (qy * qz - qw * qx)
  const fz = -(1 - 2 * (qx * qx + qy * qy))
  return [x + fx, y + fy, z + fz]
}
