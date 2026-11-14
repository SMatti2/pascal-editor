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

/** The current viewport as a capture a view can stand on: perspective, with its camera. */
async function captureCurrent(projectId: string, sceneId: string): Promise<SavedCapture> {
  const scene = await stampScene(sceneId)
  const hidden = hiddenLevels()
  const frame = await requestFrame(projectId)
  if (!frame.camera) throw new Error('L’editor non ha restituito la camera')
  poseOf(frame.camera)
  return saveCapture(frame, scene, hidden)
}

/** A new view named `name` on what the viewport shows now. */
export async function addView(projectId: string, sceneId: string, name: string) {
  const capture = await captureCurrent(projectId, sceneId)
  return changeView(sceneId, { action: 'add', name, capture: capture.id })
}

/** A new angle for `view`: what the viewport shows now. */
export async function reframeView(projectId: string, sceneId: string, view: View) {
  const capture = await captureCurrent(projectId, sceneId)
  return changeView(sceneId, { action: 'shoot', id: view.id, capture: capture.id })
}

/** `view` shot again from its own camera, at its own size, on the model as it is now. */
async function shootView(projectId: string, sceneId: string, view: View) {
  const scene = await stampScene(sceneId)
  const frame = await requestFrame(projectId, {
    pose: poseOf(view.camera),
    size: { w: view.width, h: view.height },
  })
  const capture = await saveCapture(
    { blob: frame.blob, camera: view.camera },
    scene,
    view.hidden_levels,
  )
  return changeView(sceneId, { action: 'shoot', id: view.id, capture: capture.id })
}

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
