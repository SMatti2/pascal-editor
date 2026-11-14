import { afterEach, expect, spyOn, test } from 'bun:test'
import { nodeRegistry, sceneRegistry, useScene } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { Group, Mesh } from 'three'
import { exportGlb, startRender, unbuiltNodes } from './cycles'

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

test('from 2D the export runs in 3D even when the exporter is already registered', async () => {
  // A cabinet placed in 2D has no geometry until the 3D view builds it.
  const blob = new Blob(['glTF'])
  const viewAtExport: string[] = []
  useEditor.getState().setViewMode('2d')
  useEditor.setState({
    modelExport: async () => {
      viewAtExport.push(useEditor.getState().viewMode)
      return { blob, filename: 'm.glb' }
    },
  })
  expect(await exportGlb()).toBe(blob)
  expect(viewAtExport).toEqual(['3d'])
  expect(useEditor.getState().viewMode).toBe('2d')
})

test('a visible geometry node counts as unbuilt until its 3D object holds a mesh', () => {
  const get = spyOn(nodeRegistry, 'get').mockImplementation(((type: string) =>
    type === 'cabinet-module' ? { geometry: () => ({ children: [] }) } : undefined) as never)
  const nodes = useScene.getState().nodes
  const hob = new Group()
  useScene.setState({
    nodes: {
      ...nodes,
      hob: { id: 'hob', type: 'cabinet-module' },
      hidden: { id: 'hidden', type: 'cabinet-module', visible: false },
      wall: { id: 'wall', type: 'wall' },
    } as never,
  })
  for (const id of ['hob', 'hidden', 'wall'])
    sceneRegistry.nodes.set(id, id === 'hob' ? hob : new Group())
  try {
    expect(unbuiltNodes()).toEqual(['hob'])
    hob.add(new Group().add(new Mesh()))
    expect(unbuiltNodes()).toEqual([])
  } finally {
    for (const id of ['hob', 'hidden', 'wall']) sceneRegistry.nodes.delete(id)
    useScene.setState({ nodes })
    get.mockRestore()
  }
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
