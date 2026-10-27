import { afterEach, expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { drawPlan, planDimensions, sheetUrl } from './plan'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const dimension = (id: string, extra: Record<string, unknown>) =>
  ({
    id,
    type: 'construction-dimension',
    visible: true,
    mode: 'linear',
    drawingType: 'floor-plan',
    anchors: [
      [0, 0, 1],
      [3, 0, 1],
    ],
    baseline: { origin: [0, 1.5], direction: [1, 0] },
    ...extra,
  }) as unknown as AnyNode

test('floor-plan linear dimensions go with resolved anchors; dangling ones are counted, not sent', () => {
  const lost = {
    kind: 'feature',
    reference: { nodeId: 'wall_gone', featureId: 'face-left' },
    fallback: [9, 0, 9],
  }
  const nodes = {
    a: dimension('a', {}),
    b: dimension('b', { anchors: [[0, 0, 0], lost] }),
    c: dimension('c', { mode: 'radius' }),
    d: dimension('d', { drawingType: 'roof-plan' }),
    e: dimension('e', { visible: false }),
    w: { id: 'w', type: 'wall' } as unknown as AnyNode,
  }
  expect(planDimensions(nodes)).toEqual({
    dimensions: [
      {
        anchors: [
          [0, 0, 1],
          [3, 0, 1],
        ],
        origin: [0, 1.5],
        direction: [1, 0],
      },
    ],
    dangling: 1,
  })
})

test('the plan is drawn from the GLB and the dimensions, and its sheets are read through our API', async () => {
  const sent: { url: string; body: FormData }[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: init.body as FormData })
    return Response.json({ plan: { drawn_at: 't', dimensions: 0 } }, { status: 201 })
  }) as typeof fetch
  expect(await drawPlan('casa', new Blob(['glTF']), [])).toEqual({ drawn_at: 't', dimensions: 0 })
  const [request] = sent
  expect(request?.url).toBe('/api/projects/casa/pascal/plans')
  expect(request?.body.get('dimensions')).toBe('[]')
  expect((request?.body.get('file') as File | null)?.name).toBe('scene.glb')
  expect(sheetUrl('casa', 'dxf', '2026-10-27T10:00:00.000Z')).toBe(
    '/api/projects/casa/pascal/plan.dxf?v=2026-10-27T10%3A00%3A00.000Z',
  )
})
