import { afterEach, expect, test } from 'bun:test'
import { useEditor } from '@pascal-app/editor'
import { exportGlb, startRender } from './cycles'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  useEditor.setState({ modelExport: null })
})

test('the model comes from the editor export, never as a download', async () => {
  const asked: unknown[] = []
  const blob = new Blob(['glTF'])
  useEditor.setState({
    modelExport: async (format, options) => {
      asked.push([format, options])
      return { blob, filename: 'model.glb' }
    },
  })
  expect(await exportGlb()).toBe(blob)
  expect(asked).toEqual([['glb', { download: false }]])
})

test('from 2D the 3D view opens until the exporter is there, then 2D comes back', async () => {
  const blob = new Blob(['glTF'])
  useEditor.getState().setViewMode('2d')
  const views: string[] = []
  const stop = useEditor.subscribe((state) => {
    views.push(state.viewMode)
    if (state.viewMode === '3d' && !state.modelExport)
      setTimeout(
        () => useEditor.setState({ modelExport: async () => ({ blob, filename: 'm.glb' }) }),
        150,
      )
  })
  expect(await exportGlb()).toBe(blob)
  stop()
  expect(views).toContain('3d')
  expect(useEditor.getState().viewMode).toBe('2d')
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
