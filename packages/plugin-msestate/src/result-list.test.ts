import { expect, test } from 'bun:test'
import { renderEntry, requestEntry } from './result-list'

test('a request shows its references and waits for Antigravity until a result lands', () => {
  const request = {
    id: 'r1',
    created_at: '2026-10-24T08:00:00Z',
    capture: 'c',
    appearance: 'luce calda',
    references: [{ path: 'sources/refs/a.png', role: 'appearance' as const }],
    results: [],
  }
  expect(requestEntry(request)).toMatchObject({
    notes: ['1 riferimento', 'in attesa di Antigravity'],
    text: 'luce calda',
    images: [],
  })
  const done = requestEntry({ ...request, results: ['x/result.png', 'x/result-02.png'] })
  expect(done.notes).toEqual(['1 riferimento'])
  expect(done.images.map((i) => i.alt)).toEqual(['Tentativo 1', 'Tentativo 2'])
})

test('a Cycles job shows size, samples and status; a failure shows its error', () => {
  const job = {
    id: 'j1',
    created_at: '2026-10-24T08:00:00Z',
    capture: 'c',
    width: 1920,
    height: 1080,
    samples: 128,
    status: 'running' as const,
    result: null,
  }
  expect(renderEntry(job).notes).toEqual(['1920×1080', '128 campioni', 'Blender al lavoro…'])
  expect(renderEntry({ ...job, status: 'failed', error: 'import failed' })).toMatchObject({
    text: 'import failed',
    images: [],
  })
  expect(renderEntry({ ...job, status: 'done', result: 'j1/result.png' }).images).toEqual([
    { path: 'j1/result.png', alt: 'Render Cycles' },
  ])
})
