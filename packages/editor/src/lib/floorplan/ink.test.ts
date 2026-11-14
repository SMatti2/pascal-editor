import { describe, expect, test } from 'bun:test'
import type { FloorplanGeometry } from '@pascal-app/core'
import { inkFill, inkFloorplan, inkStroke, isWash } from './ink'

describe('plan ink', () => {
  test('a cut wall or block is the cut grey with an ink edge', () => {
    expect(inkFill('wall', '#374151')).toBe('#9a9a9a')
    expect(inkFill('block', '#1f2937')).toBe('#9a9a9a')
    expect(inkStroke('block', '#1f2937')).toBe('#2b2b2b')
  })

  test('slabs and blocks below the cut are the floor grey, not blue-grey', () => {
    expect(inkFill('slab', '#cbd5e1')).toBe('#e4e4e4')
    expect(inkFill('block', '#cbd5e1')).toBe('#e4e4e4')
  })

  test('a grey wash goes transparent; floors, white masks and furniture stay', () => {
    expect(isWash('block', '#cbd5e1')).toBe(true)
    expect(isWash('ceiling', '#f6f6f6')).toBe(true)
    expect(isWash('slab', '#cbd5e1')).toBe(false)
    expect(isWash('window', '#ffffff')).toBe(false)
    expect(isWash('door', 'rgba(255, 255, 255, 0.96)')).toBe(false)
    expect(isWash('block', '#374151')).toBe(false)
    expect(isWash('imported-mesh', '#94a3b8')).toBe(false)
    const block = inkFloorplan('block', { kind: 'polygon', points: [], fill: '#cbd5e1' })
    expect((block as { fillOpacity?: number }).fillOpacity).toBe(0)
  })

  test('furniture is a translucent light shape with a grey edge', () => {
    expect(inkFill('imported-mesh', '#94a3b8')).toBe('rgba(255, 255, 255, 0.6)')
    expect(inkStroke('imported-mesh', '#334155')).toBe('#4a4a4a')
    expect(inkStroke('item', '#475569')).toBe('#4a4a4a')
  })

  test('door leaves are ink; dashed overheads stay a secondary grey', () => {
    expect(inkStroke('door', 'rgba(100, 116, 139, 0.82)')).toBe('rgba(43, 43, 43, 0.82)')
    expect(inkStroke('block', '#94a3b8')).toBe('#4a4a4a')
    expect(inkStroke('ceiling', '#94a3b8')).toBe('#4a4a4a')
  })

  test('selection, hover and handle colours are kept', () => {
    for (const c of ['#f97316', '#fed7aa', '#3b82f6', '#60a5fa', '#6366f1', '#0f766e']) {
      expect(inkFill('wall', c)).toBe(c)
      expect(inkStroke('wall', c)).toBe(c)
    }
  })

  test('light halos stay light; unknown paint passes through', () => {
    expect(inkStroke('zone', '#f8fafc')).toBe('#e4e4e4')
    expect(inkFill('wall', 'url(#hatch)')).toBe('url(#hatch)')
    expect(inkFill('wall', undefined)).toBeUndefined()
  })

  test('walks groups; drops the outline of an unfilled zone; keeps hatches', () => {
    const geometry: FloorplanGeometry = {
      kind: 'group',
      children: [
        {
          kind: 'polygon',
          points: [],
          fill: '#3b82f6',
          stroke: '#3b82f6',
          fillOpacity: 0,
        } as FloorplanGeometry,
        { kind: 'hatch', points: [], color: '#94a3b8' },
      ],
    }
    const out = inkFloorplan('zone', geometry) as Extract<FloorplanGeometry, { kind: 'group' }>
    expect((out.children[0] as { stroke?: string }).stroke).toBe('none')
    expect(out.children[1]).toEqual({ kind: 'hatch', points: [], color: '#94a3b8' })
  })
})
