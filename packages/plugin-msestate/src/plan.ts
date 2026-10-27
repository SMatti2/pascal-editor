import type { AnyNode, AnyNodeId, ConstructionDimensionNode } from '@pascal-app/core'
import { resolveMeasurementAnchor } from '@pascal-app/nodes'
import { projectApi, replyOf } from './http'

/** A construction dimension with its anchors resolved now, as our server prints it (Pascal metres). */
export type PlanDimension = {
  anchors: [number, number, number][]
  origin: [number, number]
  direction: [number, number]
}

/** The project's current plan on our server. */
export type Plan = {
  drawn_at: string
  glb_sha256?: string
  dimensions?: number
  oblique_left_out?: number
}

const api = (sceneId: string) => `${projectApi(sceneId)}/pascal`

/** The sheet's address through the editor's origin: `svg` to look at, `dxf` for CAD. */
export const sheetUrl = (sceneId: string, kind: 'svg' | 'dxf', drawnAt: string) =>
  `${api(sceneId)}/plan.${kind}?v=${encodeURIComponent(drawnAt)}`

/**
 * The floor-plan linear dimensions, anchors resolved by Pascal against the scene as it is. A
 * dimension whose anchor no longer finds its feature (dangling) is counted and left out: its stored
 * point may be stale.
 */
export function planDimensions(nodes: Record<string, AnyNode>): {
  dimensions: PlanDimension[]
  dangling: number
} {
  const resolve = (id: AnyNodeId) => nodes[id]
  const dimensions: PlanDimension[] = []
  let dangling = 0
  for (const node of Object.values(nodes)) {
    if (node.type !== 'construction-dimension' || node.visible === false) continue
    const dim = node as ConstructionDimensionNode
    if (dim.mode !== 'linear' || dim.drawingType !== 'floor-plan') continue
    const resolved = dim.anchors.map((anchor) => resolveMeasurementAnchor(anchor, resolve))
    if (resolved.some((anchor) => anchor.dangling)) {
      dangling += 1
      continue
    }
    dimensions.push({
      anchors: resolved.map((anchor) => anchor.point),
      origin: dim.baseline.origin,
      direction: dim.baseline.direction,
    })
  }
  return { dimensions, dangling }
}

/** Draw the plan on our server from the model exported now and the resolved dimensions. */
export async function drawPlan(sceneId: string, glb: Blob, dimensions: PlanDimension[]) {
  const body = new FormData()
  body.append('dimensions', JSON.stringify(dimensions))
  body.append('file', glb, 'scene.glb')
  const response = await fetch(`${api(sceneId)}/plans`, { method: 'POST', body })
  return (await replyOf<{ plan: Plan }>(response, 'Pianta non disegnata')).plan
}

export async function currentPlan(sceneId: string): Promise<Plan | null> {
  const response = await fetch(`${api(sceneId)}/plans`, { cache: 'no-store' })
  return (await replyOf<{ plan: Plan | null }>(response, 'Pianta non disponibile')).plan
}
