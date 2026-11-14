import {
  emitter,
  type LevelNode,
  type SnapshotCapturedEvent,
  type SnapshotCapturePose,
  useScene,
} from '@pascal-app/core'
import { resolveLevelVisibility, useViewer } from '@pascal-app/viewer'

/* What the editor shows right now: the frame, and the levels it leaves out. */

const FRAME_TIMEOUT_MS = 30_000

/** A stored camera to shoot from, and the frame's size in pixels. */
export type Shot = { pose: SnapshotCapturePose; size: { w: number; h: number } }

/**
 * One frame, Pascal storing nothing (ephemeral): the whole viewport as the user sees it (the only
 * capture that reports its camera), or with `shot` that camera at that size, the user's own camera
 * left where it is.
 */
export function requestFrame(projectId: string, shot?: Shot): Promise<SnapshotCapturedEvent> {
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
      ephemeral: true,
      ...(shot
        ? { captureMode: 'standard', cameraPose: shot.pose, standardSize: shot.size }
        : { captureMode: 'viewport' }),
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
