import type {
  FloorplanGeometry,
  FloorplanPoint,
  GeometryContext,
  ImportedMeshNode,
} from '@pascal-app/core'
import { readFloorplanContext } from '@pascal-app/editor'
import { OVERHEAD_STYLE, PLAN_CUT_HEIGHT } from '../block/floorplan'
import { convexHull } from '../shared/convex-hull'

type Footprint = { hull: [number, number][]; bottom: number; top: number }

/** Thinner than this, a mesh is a surface finish (a floor covering), not an object a plan draws. */
const SURFACE_THICKNESS = 0.01

const footprintByPrimitives = new WeakMap<ImportedMeshNode['primitives'], Footprint | null>()

/** The mesh's plan outline (convex hull of its XZ points) and lowest local y, cached per geometry. */
function footprint(primitives: ImportedMeshNode['primitives']): Footprint | null {
  if (footprintByPrimitives.has(primitives)) return footprintByPrimitives.get(primitives)!
  const points: FloorplanPoint[] = []
  let bottom = Number.POSITIVE_INFINITY
  let top = Number.NEGATIVE_INFINITY
  for (const primitive of primitives) {
    for (let i = 0; i + 2 < primitive.positions.length; i += 3) {
      points.push([primitive.positions[i]!, primitive.positions[i + 2]!])
      bottom = Math.min(bottom, primitive.positions[i + 1]!)
      top = Math.max(top, primitive.positions[i + 1]!)
    }
  }
  const hull = convexHull(points)
  const result = hull.length >= 3 && Number.isFinite(bottom) ? { hull, bottom, top } : null
  footprintByPrimitives.set(primitives, result)
  return result
}

/**
 * Imported geometry in plan, drawn like a block: its outline, an outline in plan ink on a
 * drafted sheet; wholly above the plan cut (wall cabinets, a hood, a mirror) dashed in the
 * live plan and left off a sheet. A flat mesh (a floor covering) is a finish, not drawn.
 */
export function buildImportedMeshFloorplan(
  node: ImportedMeshNode,
  ctx: GeometryContext,
): FloorplanGeometry | null {
  const shape = footprint(node.primitives)
  // a floor covering would wash over the whole room; the plan leaves surface finishes out
  if (!shape || shape.top - shape.bottom < SURFACE_THICKNESS) return null
  const drafting = readFloorplanContext(ctx).drafting
  const overhead = node.position[1] + shape.bottom > PLAN_CUT_HEIGHT
  if (drafting && overhead) return null

  const yaw = node.rotation[1]
  const cos = Math.cos(-yaw)
  const sin = Math.sin(-yaw)
  const toPlan = ([x, z]: [number, number]): FloorplanPoint => [
    node.position[0] + x * cos - z * sin,
    node.position[2] + x * sin + z * cos,
  ]
  const selected = Boolean(ctx.viewState?.selected || ctx.viewState?.highlighted)
  return {
    kind: 'polygon',
    points: shape.hull.map(toPlan),
    fill: drafting ? 'none' : '#94a3b8',
    fillOpacity: selected ? 0.28 : 0.14,
    stroke: drafting
      ? '#111827'
      : selected
        ? (ctx.viewState?.palette?.selectedStroke ?? '#f97316')
        : '#334155',
    // plan metres, like blocks: as a non-scaling stroke 0.025 was a fortieth of a screen pixel
    strokeWidth: selected ? 0.04 : 0.02,
    ...(overhead && !selected ? OVERHEAD_STYLE : {}),
  }
}
