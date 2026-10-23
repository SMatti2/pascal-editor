'use client'

import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import {
  requestFrame,
  type SavedCapture,
  saveCapture,
  sceneIdFromPath,
  stampScene,
} from './capture'

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'saved'; capture: SavedCapture }
  | { kind: 'error'; message: string }

/** The Studio rail panel: capture the current view with the scene it shows. Models come next. */
export default function StudioPanel() {
  const projectId = useViewer((s) => s.projectId)
  const sceneId = typeof window === 'undefined' ? null : sceneIdFromPath(window.location.pathname)
  const [state, setState] = useState<State>({ kind: 'idle' })

  const capture = async () => {
    if (!projectId || !sceneId) return
    setState({ kind: 'busy' })
    try {
      const scene = await stampScene(sceneId)
      const frame = await requestFrame(projectId, 'viewport')
      setState({ kind: 'saved', capture: await saveCapture(frame, scene, 'viewport') })
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 text-sidebar-foreground">
      <h2 className="font-semibold text-base">Studio</h2>
      <p className="text-sidebar-foreground/60 text-sm">
        Cattura la vista corrente con la scena che mostra.
      </p>
      <button
        className="rounded-md bg-sidebar-accent px-3 py-2 font-medium text-sm disabled:opacity-50"
        disabled={!projectId || !sceneId || state.kind === 'busy'}
        onClick={capture}
        type="button"
      >
        {state.kind === 'busy' ? 'Cattura in corso…' : 'Cattura vista'}
      </button>
      {state.kind === 'saved' && (
        <p className="break-all text-sidebar-foreground/70 text-xs">
          Salvata: {state.capture.image}
        </p>
      )}
      {state.kind === 'error' && <p className="text-destructive text-xs">{state.message}</p>}
    </div>
  )
}
