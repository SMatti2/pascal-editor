import { expect, test } from 'bun:test'
import { requestTiles } from './results'

const request = {
  id: 'r1',
  created_at: '2026-10-24T08:00:00Z',
  capture: 'c',
  appearance: 'luce calda',
  references: [],
  results: [] as string[],
}

test('an Antigravity request waits as one tile, then each attempt is its own photo', () => {
  const [waiting] = requestTiles(request)
  expect(waiting).toMatchObject({ key: 'r1', details: 'luce calda' })
  expect(waiting?.image).toBeUndefined()
  const done = requestTiles({ ...request, results: ['x/result.png', 'x/result-02.png'] })
  expect(done.map((tile) => tile.image)).toEqual(['x/result.png', 'x/result-02.png'])
})

test('a long brief is cut under the photo and kept whole in the tooltip', () => {
  const brief = 'a'.repeat(60)
  const [tile] = requestTiles({ ...request, appearance: brief })
  expect(tile?.summary).toBe(`${'a'.repeat(39)}…`)
  expect(tile?.details).toBe(brief)
})
