import { sceneRegistry, useScene } from '@pascal-app/core'
import { type ModelExport, useEditor } from '@pascal-app/editor'
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

const SETTLE_MS = 600 // the 3D scene counts as built when nothing changed for this long
const BUILD_LIMIT_MS = 30_000

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The editor's exporter. It lives in the 3D view, so from 2D the 3D view opens until every
 * node is built (nothing left to build, no new 3D objects for SETTLE_MS), then the view goes back.
 */
async function withExporter<T>(use: (exporter: ModelExport) => Promise<T>): Promise<T> {
  const ready = useEditor.getState().modelExport
  if (ready) return use(ready)
  const view = useEditor.getState().viewMode
  useEditor.getState().setViewMode('3d')
  try {
    const deadline = Date.now() + BUILD_LIMIT_MS
    let count = -1
    let still = 0
    while (still < SETTLE_MS) {
      if (Date.now() > deadline) throw new Error('La vista 3D non ha finito di caricare il modello')
      await pause(100)
      const built = sceneRegistry.nodes.size
      const quiet = useEditor.getState().modelExport && useScene.getState().dirtyNodes.size === 0
      still = quiet && built === count ? still + 100 : 0
      count = built
    }
    return await use(useEditor.getState().modelExport!)
  } finally {
    useEditor.getState().setViewMode(view)
  }
}

/** The scene as the editor exports it (visible nodes, true level heights), without a download. */
export function exportGlb(): Promise<Blob> {
  return withExporter(async (modelExport) => {
    const artifact = await modelExport('glb', { download: false })
    if (!artifact) throw new Error('Esportazione del modello non riuscita')
    return artifact.blob
  })
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
