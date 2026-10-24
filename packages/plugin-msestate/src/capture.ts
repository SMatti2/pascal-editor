import { emitter, type LevelNode, type SnapshotCapturedEvent, useScene } from '@pascal-app/core'
import { resolveLevelVisibility, useViewer } from '@pascal-app/viewer'
import { projectApi, replyOf } from './http'

export type CaptureMode = 'standard' | 'viewport' | 'area'

/** A capture our server kept: its operation id and project-relative files. */
export type SavedCapture = { id: string; image: string; sidecar: string }

/** The scene a capture shows: the saved version and a hash of the graph as rendered. */
export type SceneStamp = { id: string; version: number; sha256: string }

const FRAME_TIMEOUT_MS = 30_000

/**
 * The saved scene this page edits. The app serves it at `/project/<scene id>`; the editor package
 * only knows its hosted `projectId` (here `default`), so the id comes from the route.
 */
export function sceneIdFromPath(pathname: string): string | null {
  const match = /^\/project\/([^/]+)\/?$/.exec(pathname)
  return match ? decodeURIComponent(match[1] as string) : null
}

/** Ask the editor for one frame of the current view; Pascal stores nothing (ephemeral). */
export function requestFrame(projectId: string, mode: CaptureMode): Promise<SnapshotCapturedEvent> {
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer)
      emitter.off('snapshot:captured', onCaptured)
      emitter.off('snapshot:capture-failed', onFailed)
    }
    const onCaptured = (event: SnapshotCapturedEvent) => {
      if (event.requestId !== requestId) return
      done()
      resolve(event)
    }
    const onFailed = (event: { requestId: string; error: string }) => {
      if (event.requestId !== requestId) return
      done()
      reject(new Error(event.error))
    }
    const timer = setTimeout(() => {
      done()
      reject(new Error('L’editor non ha restituito la vista'))
    }, FRAME_TIMEOUT_MS)
    emitter.on('snapshot:captured', onCaptured)
    emitter.on('snapshot:capture-failed', onFailed)
    emitter.emit('camera-controls:generate-thumbnail', {
      projectId,
      requestId,
      captureMode: mode,
      ephemeral: true,
    })
  })
}

/**
 * The levels the camera does not see right now, by the viewer's own rule: hidden by the author,
 * by solo mode, or above the selected floor (those stay in the shadow map only). A renderer drops
 * them so it draws what the capture shows; the GLB export keeps every level.
 */
export function hiddenLevels(): string[] {
  const levels = Object.values(useScene.getState().nodes).filter(
    (node): node is LevelNode => node.type === 'level',
  )
  const { levelMode, hideLevelsAboveSelection, selection, levelsRevealing } = useViewer.getState()
  const selectedIndex = levels.find((level) => level.id === selection.levelId)?.level
  return levels
    .filter((level) => {
      const { visible, shadowOnly } = resolveLevelVisibility({
        levelMode,
        hideAbove: hideLevelsAboveSelection,
        hasSelectedLevel: Boolean(selection.levelId),
        isSelected: level.id === selection.levelId,
        index: level.level,
        selectedIndex,
        nodeVisible: level.visible !== false,
        revealing: levelsRevealing.includes(level.id),
      })
      return !visible || shadowOnly
    })
    .map((level) => level.id)
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
  mode: CaptureMode,
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
  body.append('mode', mode)
  body.append('file', frame.blob, 'capture') // the server reads the format from the bytes (Pascal sends WebP)
  const response = await fetch(`${projectApi(scene.id)}/pascal/captures`, { method: 'POST', body })
  const { capture } = await replyOf<{ capture: Omit<SavedCapture, 'id'> }>(
    response,
    'Salvataggio non riuscito',
  )
  return { id, ...capture }
}
