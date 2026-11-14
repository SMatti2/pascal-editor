import { afterEach, expect, test } from 'bun:test'
import { listReferenceImages, PLACE, referenceGroups, uploadSourceImage } from './sources'

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

test('each reference sits in one group; the rest stays visible as unsorted', () => {
  const groups = referenceGroups([
    image('refs/ispirazione/mood.png'),
    image('refs/prodotti/grohe/rubinetto.jpg'),
    image('refs/vecchia.png'),
  ])
  expect(Object.values(groups).map((list) => list.map((i) => i.relative))).toEqual([
    ['refs/ispirazione/mood.png'],
    ['refs/prodotti/grohe/rubinetto.jpg'],
    ['refs/vecchia.png'],
  ])
})

test('an upload goes to the inspiration folder by default, or to the folder given', async () => {
  const sent: { url: string; body: FormData }[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: init.body as FormData })
    return Response.json({ file: image('refs/ispirazione/mood.png') })
  }) as typeof fetch
  const saved = await uploadSourceImage(
    'casa',
    new File(['png'], 'mood.png', { type: 'image/png' }),
  )
  expect(saved.relative).toBe('refs/ispirazione/mood.png')
  expect(sent[0]?.url).toBe('/api/projects/casa/sources/upload')
  expect(sent[0]?.body.get('path')).toBe('refs/ispirazione')
  expect(sent[0]?.body.get('operation_id')).toMatch(/^[0-9a-f-]{36}$/)
  await uploadSourceImage('casa', new File(['jpg'], 'sala.jpg'), PLACE)
  expect(sent[1]?.body.get('path')).toBe('photos')
})
