import { useScene } from '@pascal-app/core'
import { sceneIdFromPath } from './capture'
import { exportGlb, showing3d } from './model-export'
import { currentPlan, drawPlan, type Plan, planDimensions } from './plan'

/** The plan is redrawn after the scene has been still this long. */
export const IDLE_MS = 30_000

/** First 12 hex characters of the SHA-256, as our server prints `glb_sha256`. */
export async function sha12(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12)
}

/** True when the server's plan was drawn from another model or with another number of dimensions. */
export function planIsStale(plan: Plan | null, glbSha12: string, dimensions: number): boolean {
  if (!plan?.glb_sha256) return true
  return plan.glb_sha256 !== glbSha12 || (plan.dimensions ?? 0) !== dimensions
}

let started = false

/**
 * Keeps our server's plan of the open scene current, without a click: on load and after each
 * change, once the scene is still for IDLE_MS and 3D is on screen, the editor exports the model
 * and draws the plan, unless the server's plan already comes from the same model. The Pianta
 * panel's button stays for drawing on demand.
 */
export function startPlanWatch(): void {
  // Export needs the 3D scene built, and the watch never switches the layout under the user,
  // so it waits while 3D is off screen.
  if (started || typeof window === 'undefined') return
  started = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(tick, IDLE_MS)
  }

  const tick = async () => {
    const sceneId = sceneIdFromPath(window.location.pathname)
    if (!sceneId) return
    const { nodes, dirtyNodes } = useScene.getState()
    if (running || dirtyNodes.size > 0 || !showing3d() || Object.keys(nodes).length === 0) {
      schedule()
      return
    }
    running = true
    try {
      const glb = await exportGlb()
      const { dimensions } = planDimensions(useScene.getState().nodes)
      const plan = await currentPlan(sceneId)
      if (!planIsStale(plan, await sha12(glb), dimensions.length)) return
      await drawPlan(sceneId, glb, dimensions)
      console.info('[msestate] pianta aggiornata dal modello corrente')
    } catch (failure) {
      console.warn('[msestate] pianta non aggiornata:', failure)
    } finally {
      running = false
    }
  }

  useScene.subscribe((state, previous) => {
    if (state.nodes !== previous.nodes) schedule()
  })
  schedule()
}
