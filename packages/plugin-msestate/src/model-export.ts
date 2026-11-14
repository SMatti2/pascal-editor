import { type AnyNodeId, nodeRegistry, sceneRegistry, useScene } from '@pascal-app/core'
import { type ModelExport, useEditor } from '@pascal-app/editor'
import type { Mesh } from 'three'

const SETTLE_MS = 600 // the 3D scene counts as built when nothing changed for this long
const BUILD_LIMIT_MS = 30_000

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Visible nodes of a kind built by `def.geometry` (cabinets, shelves) whose 3D object holds no mesh
 * yet. Their geometry builds only in the 3D view, some frames after it opens.
 */
export function unbuiltNodes(): string[] {
  const { nodes } = useScene.getState()
  const out: string[] = []
  for (const [id, object] of sceneRegistry.nodes) {
    const node = nodes[id as AnyNodeId]
    if (!node || node.visible === false || !nodeRegistry.get(node.type)?.geometry) continue
    let mesh = false
    object.traverse((child) => {
      if ((child as Mesh).isMesh) mesh = true
    })
    if (!mesh) out.push(id)
  }
  return out
}

/**
 * The editor's exporter, once every node is built: nothing left to build, every geometry node
 * holding a mesh, no new 3D objects for SETTLE_MS. Geometry builds only in the 3D view, and the
 * exporter stays registered in 2D, so from 2D the 3D view opens for the export, then goes back.
 * Past BUILD_LIMIT_MS the export runs with what is built; with no exporter by then, it fails.
 */
async function withExporter<T>(use: (exporter: ModelExport) => Promise<T>): Promise<T> {
  const view = useEditor.getState().viewMode
  if (view !== '3d') useEditor.getState().setViewMode('3d')
  try {
    const deadline = Date.now() + BUILD_LIMIT_MS
    let count = -1
    let still = 0
    while (still < SETTLE_MS && Date.now() <= deadline) {
      await pause(100)
      const built = sceneRegistry.nodes.size
      const quiet =
        useEditor.getState().modelExport &&
        useScene.getState().dirtyNodes.size === 0 &&
        unbuiltNodes().length === 0
      still = quiet && built === count ? still + 100 : 0
      count = built
    }
    const exporter = useEditor.getState().modelExport
    if (!exporter) throw new Error('La vista 3D non ha finito di caricare il modello')
    return await use(exporter)
  } finally {
    if (view !== '3d') useEditor.getState().setViewMode(view)
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
