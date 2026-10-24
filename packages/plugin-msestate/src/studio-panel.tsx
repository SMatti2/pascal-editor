'use client'

import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { AntigravitySection } from './antigravity-section'
import { captureView, type SavedCapture, sceneIdFromPath } from './capture'
import { CyclesSection } from './cycles-section'
import { thumbnailUrl } from './http'
import { useStep } from './use-step'

/**
 * The Studio rail panel: capture the current view (scene version and camera kept with it), then
 * hand it to Antigravity or redraw it in Cycles. Results saved for either appear by themselves.
 */
export default function StudioPanel() {
  const projectId = useViewer((s) => s.projectId)
  const sceneId = typeof window === 'undefined' ? null : sceneIdFromPath(window.location.pathname)
  const [capture, setCapture] = useState<SavedCapture | null>(null)
  const { busy, run, line } = useStep()

  const takeCapture = () =>
    run('Cattura in corso…', async () => {
      if (projectId && sceneId) setCapture(await captureView(projectId, sceneId))
    })

  return (
    <div className="flex flex-col gap-4 p-4 text-sidebar-foreground">
      <h2 className="font-semibold text-base">Studio</h2>
      <button
        className="rounded-md bg-sidebar-accent px-3 py-2 font-medium text-sm disabled:opacity-50"
        disabled={!projectId || !sceneId || busy}
        onClick={takeCapture}
        type="button"
      >
        {capture ? 'Cattura di nuovo' : 'Cattura vista'}
      </button>
      {line}
      {capture && sceneId && (
        <img
          alt="Vista catturata"
          className="w-full rounded"
          src={thumbnailUrl(sceneId, capture.image, 384)}
        />
      )}
      {sceneId && <AntigravitySection capture={capture} sceneId={sceneId} />}
      {sceneId && <CyclesSection capture={capture} sceneId={sceneId} />}
    </div>
  )
}
