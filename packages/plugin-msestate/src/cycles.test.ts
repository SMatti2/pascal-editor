import { afterEach, expect, test } from 'bun:test'
import { startRender } from './cycles'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

test('a render is queued with the capture id and the GLB', async () => {
  const sent: { url: string; body: FormData }[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: init.body as FormData })
    return Response.json({ render: { id: 'j1' } }, { status: 202 })
  }) as typeof fetch
  expect(await startRender('casa', 'cap-1', new Blob(['glTF']), '2026-06-21T10:00')).toEqual({
    id: 'j1',
  })
  const [request] = sent
  expect(request?.url).toBe('/api/projects/casa/pascal/cycles')
  expect(request?.body.get('capture')).toBe('cap-1')
  expect(request?.body.get('sun_at')).toBe('2026-06-21T10:00')
  expect((request?.body.get('file') as File | null)?.name).toBe('scene.glb')
})
