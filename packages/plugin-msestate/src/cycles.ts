import { useEditor } from '@pascal-app/editor'
import { projectApi, replyOf } from './http'

/** A Cycles job on our server: queued → running → done | failed, with its result when done. */
export type CyclesRender = {
  id: string
  created_at: string
  capture: string
  width: number
  height: number
  samples: number
  sun_at: string | null
  status: 'queued' | 'running' | 'done' | 'failed'
  error?: string
  result: string | null
}

const api = (sceneId: string) => `${projectApi(sceneId)}/pascal/cycles`

/** The scene as the editor exports it (visible nodes, true level heights), without a download. */
export async function exportGlb(): Promise<Blob> {
  const modelExport = useEditor.getState().modelExport
  if (!modelExport) throw new Error('L’editor non è ancora pronto per esportare il modello')
  const artifact = await modelExport('glb', { download: false })
  if (!artifact) throw new Error('Esportazione del modello non riuscita')
  return artifact.blob
}

/**
 * Queue a Cycles render of a saved capture with the model exported now. `sunAt` (local
 * `YYYY-MM-DDTHH:MM`) asks for the real sun at the project's place; none keeps neutral daylight.
 */
export async function startRender(sceneId: string, capture: string, glb: Blob, sunAt = '') {
  const body = new FormData()
  body.append('capture', capture)
  if (sunAt) body.append('sun_at', sunAt)
  body.append('file', glb, 'scene.glb')
  const response = await fetch(api(sceneId), { method: 'POST', body })
  return (await replyOf<{ render: { id: string } }>(response, 'Render non avviato')).render
}

export async function listRenders(sceneId: string): Promise<CyclesRender[]> {
  const response = await fetch(api(sceneId), { cache: 'no-store' })
  return (await replyOf<{ renders: CyclesRender[] }>(response, 'Render non disponibili')).renders
}
