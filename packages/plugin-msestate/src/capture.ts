import { type SnapshotCapturedEvent, useScene } from '@pascal-app/core'
import { projectApi, replyOf } from './http'
import { hiddenLevels, requestFrame } from './view'

/** A capture our server kept: its operation id and project-relative files. */
export type SavedCapture = { id: string; image: string; sidecar: string }

/** The scene a capture shows: the saved version and a hash of the graph as rendered. */
export type SceneStamp = { id: string; version: number; sha256: string }

/**
 * The saved scene this page edits. The app serves it at `/project/<scene id>`; the editor package
 * only knows its hosted `projectId` (here `default`), so the id comes from the route.
 */
export function sceneIdFromPath(pathname: string): string | null {
  const match = /^\/project\/([^/]+)\/?$/.exec(pathname)
  return match ? decodeURIComponent(match[1] as string) : null
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Saved version from the editor's scene API (its ETag) and the hash of the nodes in memory. */
export async function stampScene(sceneId: string): Promise<SceneStamp> {
  const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}`, { method: 'HEAD' })
  const version = Number((response.headers.get('etag') ?? '').replaceAll('"', ''))
  if (!response.ok || !Number.isInteger(version))
    throw new Error(`Versione della scena ${sceneId} non disponibile (${response.status})`)
  return { id: sceneId, version, sha256: await sha256(JSON.stringify(useScene.getState().nodes)) }
}

/** Send the frame to our server, which keeps it with the scene stamp (same origin, behind the proxy). */
export async function saveCapture(
  frame: Pick<SnapshotCapturedEvent, 'blob' | 'camera'>,
  scene: SceneStamp,
  hidden: string[] = [],
): Promise<SavedCapture> {
  const id = crypto.randomUUID()
  const body = new FormData()
  body.append('operation_id', id)
  body.append('scene_id', scene.id)
  body.append('scene_version', String(scene.version))
  body.append('scene_sha256', scene.sha256)
  if (frame.camera) body.append('camera', JSON.stringify(frame.camera)) // the pose a renderer redraws
  body.append('hidden_levels', JSON.stringify(hidden))
  body.append('file', frame.blob, 'capture') // the server reads the format from the bytes (Pascal sends WebP)
  const response = await fetch(`${projectApi(scene.id)}/pascal/captures`, { method: 'POST', body })
  const { capture } = await replyOf<{ capture: Omit<SavedCapture, 'id'> }>(
    response,
    'Salvataggio non riuscito',
  )
  return { id, ...capture }
}

/**
 * Capture the current view of the scene this page edits: its saved version and graph hash, the
 * levels the view leaves out (read before the frame, as shown), the frame and its camera.
 */
export async function captureView(projectId: string, sceneId: string): Promise<SavedCapture> {
  const scene = await stampScene(sceneId)
  const hidden = hiddenLevels()
  return saveCapture(await requestFrame(projectId), scene, hidden)
}
