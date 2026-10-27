import type { FloorplanPoint } from '@pascal-app/core'

function cross(origin: FloorplanPoint, a: FloorplanPoint, b: FloorplanPoint) {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0])
}

/** The convex hull of plan points, counter-clockwise (monotone chain). */
export function convexHull(points: readonly FloorplanPoint[]): [number, number][] {
  const unique = [...new Map(points.map((point) => [`${point[0]}:${point[1]}`, point])).values()]
  if (unique.length <= 3) return unique as [number, number][]
  unique.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const lower: FloorplanPoint[] = []
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop()
    lower.push(point)
  }
  const upper: FloorplanPoint[] = []
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop()
    upper.push(point)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)] as [number, number][]
}
