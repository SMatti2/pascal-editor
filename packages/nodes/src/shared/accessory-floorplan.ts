import type {
  DuctFittingNode,
  FloorplanGeometry,
  GeometryContext,
  PipeFittingNode,
} from '@pascal-app/core'
import { Euler, type Group, Mesh, Vector3 } from 'three'
import { convexHull } from './convex-hull'

export function accessoryFloorplan(
  group: Group,
  node: DuctFittingNode | PipeFittingNode,
  ctx: GeometryContext,
): FloorplanGeometry {
  group.updateMatrixWorld(true)
  const euler = new Euler(...node.rotation)
  const selected = ctx.viewState?.selected || ctx.viewState?.highlighted
  const stroke = selected ? (ctx.viewState?.palette?.selectedStroke ?? '#6366f1') : '#475569'
  const children: FloorplanGeometry[] = []
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const positions = object.geometry.getAttribute('position')
    const points: [number, number][] = []
    for (let i = 0; i < positions.count; i++) {
      const p = new Vector3()
        .fromBufferAttribute(positions, i)
        .applyMatrix4(object.matrixWorld)
        .applyEuler(euler)
      points.push([p.x + node.position[0], p.z + node.position[2]])
    }
    const outline = convexHull(points)
    if (outline.length >= 3)
      children.push({
        kind: 'polygon',
        points: outline,
        fill: '#cbd5e1',
        stroke,
        strokeWidth: 1,
        vectorEffect: 'non-scaling-stroke',
      })
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.dispose()
  })
  if (selected) children.push({ kind: 'move-handle', point: [node.position[0], node.position[2]] })
  return { kind: 'group', children }
}
