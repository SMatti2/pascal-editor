import { describe, expect, test } from 'bun:test'
import type { WallNode } from '../../schema'
import { getWallPlanFootprint } from './wall-footprint'
import { calculateLevelMiters, getWallMiterBoundaryPoints, pointToKey } from './wall-mitering'

function wall(id: string, start: [number, number], end: [number, number]): WallNode {
  return {
    id,
    type: 'wall',
    object: 'node',
    visible: true,
    parentId: 'level_test',
    children: [],
    start,
    end,
    thickness: 0.1,
    height: 2.5,
    frontSide: 'interior',
    backSide: 'exterior',
    metadata: {},
  } as WallNode
}

function maxBoundaryCoord(walls: WallNode[]): number {
  const miter = calculateLevelMiters(walls)
  let max = 0
  for (const w of walls) {
    const bp = getWallMiterBoundaryPoints(w, miter)
    expect(bp).not.toBeNull()
    if (!bp) continue
    for (const p of [bp.startLeft, bp.startRight, bp.endLeft, bp.endRight]) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      max = Math.max(max, Math.abs(p.x), Math.abs(p.y))
    }
  }
  return max
}

describe('wall mitering miter limit', () => {
  // Two 3 m walls sharing the origin, meeting at decreasing angles. Without a
  // miter limit the joint point runs to infinity as the angle → 0 (∝ 1/sin θ),
  // which is the "infinite wall" seen when a room-preset preview lands on top of
  // an existing wall. The boundary must stay bounded near the wall length.
  test.each([90, 30, 10, 5, 1, 0.1, 0.01])('stays bounded at a %s° junction', (deg) => {
    const rad = (deg * Math.PI) / 180
    const walls = [
      wall('A', [0, 0], [3, 0]),
      wall('B', [0, 0], [3 * Math.cos(rad), 3 * Math.sin(rad)]),
    ]
    // 3 m walls + a few cm of joint: anything past ~4 m is a runaway spike.
    expect(maxBoundaryCoord(walls)).toBeLessThan(4)
  })

  test('still miters a normal 90° corner', () => {
    const walls = [wall('A', [0, 0], [3, 0]), wall('B', [0, 0], [0, 3])]
    const miter = calculateLevelMiters(walls)
    const bpA = getWallMiterBoundaryPoints(walls[0]!, miter)
    expect(bpA).not.toBeNull()
    if (!bpA) throw new Error('expected miter boundary points')
    // The shared corner is pulled to the mitred intersection, offset from the
    // raw butt position (halfThickness 0.05) by the diagonal of the joint.
    const startSideX = Math.min(bpA.startLeft.x, bpA.startRight.x)
    expect(startSideX).toBeLessThan(-0.001)
    expect(startSideX).toBeGreaterThan(-0.5)
  })
})

describe('wall miter boundary sides', () => {
  test('keeps left and right on the same physical face at both free endpoints', () => {
    const node = wall('A', [0, 0], [3, 0])
    const boundary = getWallMiterBoundaryPoints(node, calculateLevelMiters([node]))
    expect(boundary).not.toBeNull()
    if (!boundary) throw new Error('expected miter boundary points')

    expect(boundary.startLeft.y).toBeCloseTo(0.05)
    expect(boundary.endLeft.y).toBeCloseTo(0.05)
    expect(boundary.startRight.y).toBeCloseTo(-0.05)
    expect(boundary.endRight.y).toBeCloseTo(-0.05)
  })
})

describe('deterministic junction ordering', () => {
  test('same wall set produces the same miter data regardless of input order', () => {
    const thickWall = (id: string, thickness: number, end: [number, number]) =>
      ({ ...wall(id, [0, 0], end), thickness }) as WallNode
    const wide = thickWall('wide', 0.6, [4, 0])
    const narrow = thickWall('narrow', 0.2, [4, 0])
    const branch = thickWall('branch', 0.4, [0, 4])

    const forward = calculateLevelMiters([wide, narrow, branch]).junctionData.get('0,0')
    const reversed = calculateLevelMiters([narrow, wide, branch]).junctionData.get('0,0')

    expect(forward).toEqual(reversed)
  })
})

describe('junction grid prefilter', () => {
  function thickWall(
    id: string,
    start: [number, number],
    end: [number, number],
    thickness: number,
  ): WallNode {
    return { ...wall(id, start, end), thickness } as WallNode
  }

  // A wall covering more than JUNCTION_GRID_MAX_CELLS_PER_WALL grid cells is held
  // in the fallback bucket, which is scanned after the per-cell bucket. When such
  // a wall and a shorter collinear one both pass through a junction they tie on
  // angle, so the order they were appended in decides which thickness the miter
  // uses — the prefilter must not reorder them relative to the input.
  test('an oversized wall keeps its input position among collinear passthroughs', () => {
    const long = thickWall('long', [0, 0], [20, 20], 0.6)
    const infill = thickWall('infill', [4, 4], [12, 12], 0.15)
    const spur = thickWall('spur', [8, 8], [8, 14], 0.3)

    const junction = calculateLevelMiters([long, infill, spur]).junctions.get(
      pointToKey({ x: 8, y: 8 }),
    )
    expect(junction).toBeDefined()
    expect(junction?.connectedWalls.map((cw) => cw.wall.id)).toEqual(['spur', 'long', 'infill'])
  })

  test('a junction on a long wall is still found through the fallback bucket', () => {
    const long = thickWall('long', [0, 0], [140, 0], 0.2)
    const spur = thickWall('spur', [60, 0], [60, 6], 0.2)

    const junction = calculateLevelMiters([long, spur]).junctions.get(pointToKey({ x: 60, y: 0 }))
    expect(junction?.connectedWalls.map((cw) => cw.wall.id)).toEqual(['spur', 'long'])
  })
})

describe('wall ends stop at the face they meet', () => {
  // A wall whose end both edges meet another wall's face must close flat on that
  // face. Closing through the junction point pokes a triangle into the other wall:
  // two coplanar tops, which a path tracer renders as black specks.
  function inside(p: { x: number; y: number }, polygon: { x: number; y: number }[]) {
    let hit = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i]!
      const b = polygon[j]!
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
        hit = !hit
    }
    return hit
  }
  // Strictly inside: points on the shared miter line do not count.
  function deepInside(p: { x: number; y: number }, polygon: { x: number; y: number }[]) {
    const nearEdge = polygon.some((a, i) => {
      const b = polygon[(i + 1) % polygon.length]!
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) /
            ((b.x - a.x) ** 2 + (b.y - a.y) ** 2),
        ),
      )
      return Math.hypot(p.x - a.x - t * (b.x - a.x), p.y - a.y - t * (b.y - a.y)) < 1e-6
    })
    return !nearEdge && inside(p, polygon)
  }
  function pokes(walls: WallNode[], into: string, from: string) {
    const miter = calculateLevelMiters(walls)
    const host = getWallPlanFootprint(walls.find((w) => w.id === into)!, miter)
    const other = getWallPlanFootprint(walls.find((w) => w.id === from)!, miter)
    return other.some((p) => deepInside(p, host))
  }
  const thick = (w: WallNode, thickness: number) => ({ ...w, thickness }) as WallNode

  test('a wall ending on the middle of another (T)', () => {
    const walls = [wall('host', [0, 0], [4, 0]), wall('stem', [2, 0], [2, 3])]
    expect(pokes(walls, 'host', 'stem')).toBe(false)
  })

  test('a thin wall ending on the end of a thick one', () => {
    const walls = [
      thick(wall('spine', [0, 3], [0, 0]), 0.8),
      thick(wall('thin', [0, 0], [3, 0]), 0.15),
    ]
    expect(pokes(walls, 'spine', 'thin')).toBe(false)
  })

  test('an even corner keeps its miter', () => {
    const walls = [wall('A', [0, 0], [3, 0]), wall('B', [0, 0], [0, 3])]
    expect(pokes(walls, 'A', 'B')).toBe(false)
    expect(pokes(walls, 'B', 'A')).toBe(false)
  })
})
