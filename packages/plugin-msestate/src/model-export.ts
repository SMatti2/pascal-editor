import { type AnyNodeId, nodeRegistry, sceneRegistry, useScene } from '@pascal-app/core'
import {
  activeViewLayout,
  type ModelExport,
  sceneLayout,
  useEditor,
  visibleScene,
} from '@pascal-app/editor'

const POLL_MS = 100
const SETTLE_MS = 600 // the 3D scene counts as built when nothing changed for this long
const BUILD_LIMIT_MS = 30_000

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Visible nodes of a kind built by `def.geometry` (cabinets, shelves) whose 3D object holds no mesh
 * yet. Their geometry builds only in the 3D view, some frames after it opens.
 */
export function unbuiltNodes(): string[] {
  const { nodes } = useScene.getState()
  return [...sceneRegistry.nodes]
    .filter(([id, object]) => {
      const node = nodes[id as AnyNodeId]
      if (!node || node.visible === false || !nodeRegistry.get(node.type)?.geometry) return false
      return !object.getObjectByProperty('isMesh', true)
    })
    .map(([id]) => id)
}

/** Exporter there, nothing left to build, every geometry node holding a mesh. */
const built = () =>
  Boolean(useEditor.getState().modelExport) &&
  useScene.getState().dirtyNodes.size === 0 &&
  unbuiltNodes().length === 0

/** Resolves once the scene is built and no new 3D object appeared for SETTLE_MS, or at the deadline. */
async function untilBuilt(deadline: number): Promise<void> {
  let count = -1
  let still = 0
  while (still < SETTLE_MS && Date.now() <= deadline) {
    await pause(POLL_MS)
    const objects = sceneRegistry.nodes.size
    still = built() && objects === count ? still + POLL_MS : 0
    count = objects
  }
}

/** True when the 3D view is on screen, alone or split, so the geometry is built. */
export function showing3d(): boolean {
  const scene = visibleScene(useEditor.getState())
  return scene === '3d' || scene === 'split'
}

/**
 * The editor's exporter, once the scene is built. Geometry builds only while 3D is on screen, and
 * the exporter stays registered without it, so the 3D view opens for the export when it is not
 * showing, then the layout goes back. Past BUILD_LIMIT_MS the export runs with what is built;
 * with no exporter by then, it fails.
 */
async function withExporter<T>(use: (exporter: ModelExport) => Promise<T>): Promise<T> {
  const state = useEditor.getState()
  const layout = activeViewLayout(state)
  const opens3d = !showing3d()
  if (opens3d) state.setViewLayout(sceneLayout('3d'))
  try {
    await untilBuilt(Date.now() + BUILD_LIMIT_MS)
    const exporter = useEditor.getState().modelExport
    if (!exporter) throw new Error('La vista 3D non ha finito di caricare il modello')
    return await use(exporter)
  } finally {
    if (opens3d) useEditor.getState().setViewLayout(layout)
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
