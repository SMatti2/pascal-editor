import { useViewer } from '@pascal-app/viewer'
import { useBelowGrade, useGroundWindowBox } from '@pascal-app/viewer/ui'
import { useEffect } from 'react'
import useEditor, { type CaptureMode } from '../store/use-editor'

/**
 * Whether the editor shows every level. Preview and the walkthrough show the
 * whole building; a scene capture shows what its level picker says (the
 * whole building, or a level and the ones below it). A preset capture frames
 * its isolated item and keeps the editing rule.
 */
export function showsWholeBuilding(state: {
  isPreviewMode: boolean
  isFirstPersonMode: boolean
  captureMode: CaptureMode
  captureLevelId: string | null
}): boolean {
  if (state.captureMode.mode === 'standard') return state.captureLevelId === null
  return state.isPreviewMode || state.isFirstPersonMode
}

/**
 * Whether the editor hides the levels above the selected one in a level mode: stacked hides
 * them, so the storey being worked on is never covered; exploded pulls every level apart and
 * shows them all; solo shows the selected level alone.
 */
export const hidesLevelsAbove = (levelMode: string) =>
  levelMode === 'stacked' || levelMode === 'manual'

/**
 * The editor's level display: the toolbar's level mode (Stack / Exploded / Solo) holds while
 * editing. Stacked hides every level above the selected one; a mode persisted by an older
 * build ('manual') opens as stacked.
 *
 * The walkthrough shows the whole building, so the upper levels come back
 * while it is on; Preview hands the display to the viewer's own floor rule
 * (`useViewerFloorDisplay`). A level below grade is marked as shown, and its
 * ground veiled, except on the site, where the ground is what is being worked on.
 */
export function useEditorLevelDisplay(showWholeBuilding: boolean) {
  const sitePhase = useEditor((state) => state.phase === 'site')
  useBelowGrade(!(showWholeBuilding || sitePhase))
  // The ground window (a hillside in the eye's way) follows the shown level, and the whole
  // building while it stands whole — except on the site, where the ground is the work.
  useGroundWindowBox(!sitePhase)
  useEffect(() => {
    if (showWholeBuilding) return
    const viewer = useViewer.getState()
    if (viewer.levelMode === 'manual') viewer.setLevelMode('stacked')
    const follow = (mode: string) =>
      useViewer.setState({ hideLevelsAboveSelection: hidesLevelsAbove(mode) })
    follow(useViewer.getState().levelMode)
    const unsubscribe = useViewer.subscribe((state, previous) => {
      if (state.levelMode !== previous.levelMode) follow(state.levelMode)
    })
    return () => {
      unsubscribe()
      useViewer.setState({ hideLevelsAboveSelection: false })
    }
  }, [showWholeBuilding])
}
