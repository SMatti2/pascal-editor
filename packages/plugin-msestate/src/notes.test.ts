import { afterEach, expect, test } from 'bun:test'
import type { AnyNode } from '@pascal-app/core'
import { changeNote, NOTE_KINDS, pieceOf } from './notes'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('a piece not drawn yet is referenced by its own position, with its kind and name', () => {
  const node = {
    id: 'item_1',
    type: 'item',
    name: 'Lavabo',
    position: [1.23456, 0, 2],
  } as unknown as AnyNode
  expect(pieceOf(node)).toEqual({ id: 'item_1', kind: 'item', label: 'Lavabo', at: [1.235, 0, 2] })
  const room = {
    id: 'zone_1',
    type: 'zone',
    name: 'BAGNO',
    polygon: [
      [0, 0],
      [2, 0],
      [2, 4],
      [0, 4],
    ],
  }
  expect(pieceOf(room as unknown as AnyNode).at).toEqual([1, 0, 2])
  expect(NOTE_KINDS).toContain('wall')
  expect(NOTE_KINDS).not.toContain('level')
})

test('a change goes to our server as JSON and its refusal comes back as the error', async () => {
  const sent: { url: string; body: unknown }[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(init.body as string) })
    return sent.length === 1
      ? Response.json({ notes: [] })
      : Response.json({ error: 'Scrivi la nota' }, { status: 400 })
  }) as typeof fetch
  await changeNote('casa', { action: 'delete', id: 'n1' })
  expect(sent[0]).toEqual({
    url: '/api/projects/casa/pascal/notes',
    body: { action: 'delete', id: 'n1' },
  })
  await expect(changeNote('casa', { action: 'edit', id: 'n1', text: '' })).rejects.toThrow(
    'Scrivi la nota',
  )
})
