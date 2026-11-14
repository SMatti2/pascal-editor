import { afterEach, expect, spyOn, test } from 'bun:test'
import { nodeRegistry, sceneRegistry, useScene } from '@pascal-app/core'
import { sceneLayout, useEditor, type VisibleScene, visibleScene } from '@pascal-app/editor'
import { Group, Mesh } from 'three'
import { exportGlb, unbuiltNodes } from './model-export'

afterEach(() => useEditor.setState({ modelExport: null }))

test('the model comes from the editor export, never as a download', async () => {
  const asked: unknown[] = []
  useEditor.setState({
    modelExport: async (format, options) => {
      asked.push([format, options])
      return { blob, filename: 'model.glb' }
    },
  })
  expect(await exportGlb()).toBe(blob)
  expect(asked).toEqual([['glb', { download: false }]])
})

const blob = new Blob(['glTF'])
const showing = () => visibleScene(useEditor.getState())
const show = (scene: VisibleScene) => useEditor.getState().setViewLayout(sceneLayout(scene))

/** An exporter that records which scene was on screen when it ran. */
function recordingExporter(seen: unknown[]) {
  return async () => {
    seen.push(showing())
    return { blob, filename: 'm.glb' }
  }
}

test('from 2D the 3D view opens until the exporter is there, then 2D comes back', async () => {
  show('2d')
  const seen: unknown[] = []
  const stop = useEditor.subscribe((state) => {
    if (visibleScene(state) === '3d' && !state.modelExport)
      setTimeout(() => useEditor.setState({ modelExport: recordingExporter(seen) }), 150)
  })
  expect(await exportGlb()).toBe(blob)
  stop()
  expect(seen).toEqual(['3d'])
  expect(showing()).toBe('2d')
})

test('from 2D the export runs in 3D even when the exporter is already registered', async () => {
  // A cabinet placed in 2D has no geometry until the 3D view builds it.
  show('2d')
  const seen: unknown[] = []
  useEditor.setState({ modelExport: recordingExporter(seen) })
  expect(await exportGlb()).toBe(blob)
  expect(seen).toEqual(['3d'])
  expect(showing()).toBe('2d')
})

test('in split view 3D is already on screen: the layout stays', async () => {
  show('split')
  const seen: unknown[] = []
  useEditor.setState({ modelExport: recordingExporter(seen) })
  await exportGlb()
  expect(seen).toEqual(['split'])
  expect(showing()).toBe('split')
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
