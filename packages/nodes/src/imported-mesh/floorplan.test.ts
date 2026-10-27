import { describe, expect, test } from 'bun:test'
import type { GeometryContext, ImportedMeshNode } from '@pascal-app/core'
import { createFloorplanContextExtensions } from '@pascal-app/editor'
import { buildImportedMeshFloorplan } from './floorplan'

/** A diamond (a basin, say) 1 m across in plan, 0.2 m tall, its bottom at `y`. */
function diamond(y: number): ImportedMeshNode {
  const ring = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ].map(([x, z]) => [x! / 2, z! / 2])
  const positions = [0, 0.2].flatMap((h) => ring.flatMap(([x, z]) => [x!, h, z!]))
  return {
    id: 'imesh_1',
    type: 'imported-mesh',
    position: [2, y, 3],
    rotation: [0, 0, 0],
    primitives: [{ positions, indices: [] }],
  } as unknown as ImportedMeshNode
}

const ctxFor = (drafting: boolean): GeometryContext =>
  ({
    viewState: { selected: false },
    extensions: createFloorplanContextExtensions({ purpose: 'document', drafting }),
  }) as unknown as GeometryContext

describe('buildImportedMeshFloorplan', () => {
  test('draws the outline of the mesh, not its bounding box', () => {
    const plan = buildImportedMeshFloorplan(diamond(0), ctxFor(false))
    expect(plan?.kind).toBe('polygon')
    if (plan?.kind !== 'polygon') return
    expect(plan.points.map(([x, y]) => [x + 0, y + 0]).sort()).toEqual(
      [
        [1.5, 3],
        [2, 2.5],
        [2, 3.5],
        [2.5, 3],
      ].sort(),
    )
  })

  test('on a sheet: plan ink outline on the floor, nothing above the cut', () => {
    const floor = buildImportedMeshFloorplan(diamond(0), ctxFor(true))
    expect(floor?.kind === 'polygon' && [floor.fill, floor.stroke]).toEqual(['none', '#111827'])
    expect(buildImportedMeshFloorplan(diamond(1.5), ctxFor(true))).toBeNull()
  })

  test('the live view shows a mesh above the cut dashed, still there to select', () => {
    const plan = buildImportedMeshFloorplan(diamond(1.5), ctxFor(false))
    expect(
      plan?.kind === 'polygon' && [plan.fill, plan.strokeDasharray, plan.vectorEffect],
    ).toEqual(['none', '0.15 0.1', undefined])
  })
})
