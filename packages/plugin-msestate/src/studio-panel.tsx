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
import { RequestList } from './request-list'
import { copyWhenReady, createRequest, thumbnailUrl } from './requests'
import { useRequests } from './use-requests'

type Step =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'copied' }
  | { kind: 'error'; message: string }

const APPEARANCE_MAX = 4000
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * The Studio rail panel: capture the current view, then hand it to Antigravity with an
 * optional appearance brief. Results saved in the request's folder appear below by themselves.
 */
export default function StudioPanel() {
  const projectId = useViewer((s) => s.projectId)
  const sceneId = typeof window === 'undefined' ? null : sceneIdFromPath(window.location.pathname)
  const [capture, setCapture] = useState<SavedCapture | null>(null)
  const [appearance, setAppearance] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const { requests, error: listError, refresh } = useRequests(sceneId)
  const busy = step.kind === 'busy'

  const captureView = async () => {
    if (!projectId || !sceneId) return
    setStep({ kind: 'busy', label: 'Cattura in corso…' })
    try {
      const scene = await stampScene(sceneId)
      const frame = await requestFrame(projectId, 'viewport')
      setCapture(await saveCapture(frame, scene, 'viewport'))
      setStep({ kind: 'idle' })
    } catch (error) {
      setStep({ kind: 'error', message: message(error) })
    }
  }

  const handOff = async () => {
    if (!sceneId || !capture) return
    setStep({ kind: 'busy', label: 'Preparo la richiesta…' })
    const request = createRequest(sceneId, capture.id, appearance)
    try {
      await copyWhenReady(request.then((prepared) => prepared.instructions))
      setStep({ kind: 'copied' })
    } catch (error) {
      setStep({ kind: 'error', message: message(error) })
    }
    void refresh()
  }

  return (
    <div className="flex flex-col gap-3 p-4 text-sidebar-foreground">
      <h2 className="font-semibold text-base">Studio</h2>
      <button
        className="rounded-md bg-sidebar-accent px-3 py-2 font-medium text-sm disabled:opacity-50"
        disabled={!projectId || !sceneId || busy}
        onClick={captureView}
        type="button"
      >
        {capture ? 'Cattura di nuovo' : 'Cattura vista'}
      </button>
      {capture && sceneId && (
        <>
          <img
            alt="Vista catturata"
            className="w-full rounded"
            src={thumbnailUrl(sceneId, capture.image, 384)}
          />
          <label className="flex flex-col gap-1 text-xs">
            Aspetto (facoltativo): finiture, luce, atmosfera
            <textarea
              className="min-h-20 rounded-md border border-sidebar-border bg-transparent p-2 text-sm"
              maxLength={APPEARANCE_MAX}
              onChange={(event) => setAppearance(event.target.value)}
              value={appearance}
            />
          </label>
          <button
            className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
            disabled={busy}
            onClick={handOff}
            type="button"
          >
            Copia istruzioni per Antigravity
          </button>
        </>
      )}
      {step.kind === 'busy' && <p className="text-sidebar-foreground/70 text-xs">{step.label}</p>}
      {step.kind === 'copied' && (
        <p className="text-sidebar-foreground/70 text-xs">
          Istruzioni copiate. Incollale in Antigravity con il repository msestate aperto: il
          risultato compare qui sotto.
        </p>
      )}
      {step.kind === 'error' && <p className="text-destructive text-xs">{step.message}</p>}
      {listError && <p className="text-destructive text-xs">{listError}</p>}
      {sceneId && <RequestList requests={requests} sceneId={sceneId} />}
    </div>
  )
}
