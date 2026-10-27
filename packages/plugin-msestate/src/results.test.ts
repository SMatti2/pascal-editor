import { expect, test } from 'bun:test'
import { renderTile, requestTiles } from './results'

const request = {
  id: 'r1',
  created_at: '2026-10-24T08:00:00Z',
  capture: 'c',
  appearance: 'luce calda',
  references: [],
  results: [] as string[],
}

test('an Antigravity request waits as one tile, then each attempt is its own photo', () => {
  expect(requestTiles(request)).toMatchObject([{ status: 'waiting', details: 'luce calda' }])
  const done = requestTiles({ ...request, results: ['x/result.png', 'x/result-02.png'] })
  expect(done.map((tile) => [tile.status, tile.image])).toEqual([
    ['done', 'x/result.png'],
    ['done', 'x/result-02.png'],
  ])
})

test('a Blender render says its light in words; only a failure offers a retry', () => {
  const job = {
    id: 'j1',
    created_at: '2026-10-24T08:00:00Z',
    capture: 'c1',
    width: 1920,
    height: 1080,
    samples: 128,
    sun_at: '2026-06-21T10:00',
    status: 'running' as const,
    result: null,
  }
  expect(renderTile(job)).toMatchObject({
    status: 'running',
    details: 'sole del 2026-06-21 alle 10:00 · 1920×1080',
    retry: undefined,
  })
  expect(renderTile({ ...job, status: 'failed', error: 'import failed' }).retry).toEqual({
    capture: 'c1',
    sunAt: '2026-06-21T10:00',
  })
})
