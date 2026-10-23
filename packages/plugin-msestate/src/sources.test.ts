import { afterEach, expect, test } from 'bun:test'
import { listReferenceImages, uploadReference } from './sources'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const image = (relative: string) => ({
  id: relative,
  name: relative.split('/').at(-1) as string,
  path: `sources/${relative}`,
  relative,
})

test('only images under sources/refs/ are offered as references', async () => {
  globalThis.fetch = (async () =>
    Response.json({
      entries: [
        image('refs/gres.png'),
        image('photos/bagno.jpg'),
        image('refs/grohe/rubinetto.jpg'),
      ],
    })) as unknown as typeof fetch
  expect((await listReferenceImages('casa')).map((i) => i.relative)).toEqual([
    'refs/gres.png',
    'refs/grohe/rubinetto.jpg',
  ])
})

test("an upload goes to Studio's appearance folder through the sources route", async () => {
  const sent: { url: string; body: FormData }[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: init.body as FormData })
    return Response.json({ file: image('refs/aspetto/mood.png') })
  }) as typeof fetch
  const saved = await uploadReference('casa', new File(['png'], 'mood.png', { type: 'image/png' }))
  expect(saved.relative).toBe('refs/aspetto/mood.png')
  expect(sent[0]?.url).toBe('/api/projects/casa/sources/upload')
  expect(sent[0]?.body.get('path')).toBe('refs/aspetto')
  expect(sent[0]?.body.get('operation_id')).toMatch(/^[0-9a-f-]{36}$/)
})
