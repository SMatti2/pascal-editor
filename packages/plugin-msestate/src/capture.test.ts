import { describe, expect, test } from 'bun:test'
import { emitter, type ThumbnailGenerateEvent } from '@pascal-app/core'
import { requestFrame, saveCapture } from './capture'

describe('requestFrame', () => {
  test('asks for an ephemeral frame and takes only the answer to its own request', async () => {
    const blob = new Blob(['png'])
    const answer = (event: ThumbnailGenerateEvent) => {
      expect(event).toMatchObject({ projectId: 'casa', captureMode: 'viewport', ephemeral: true })
      emitter.emit('snapshot:captured', {
        requestId: 'someone-else',
        blob: new Blob(['x']),
        width: 1,
        height: 1,
      })
      emitter.emit('snapshot:captured', {
        requestId: event.requestId as string,
        blob,
        width: 640,
        height: 360,
      })
    }
    emitter.on('camera-controls:generate-thumbnail', answer)
    const frame = await requestFrame('casa', 'viewport')
    emitter.off('camera-controls:generate-thumbnail', answer)
    expect(frame.blob).toBe(blob)
    expect([frame.width, frame.height]).toEqual([640, 360])
  })

  test('a failed capture rejects with the editor’s reason', async () => {
    const fail = (event: ThumbnailGenerateEvent) =>
      emitter.emit('snapshot:capture-failed', {
        requestId: event.requestId as string,
        error: 'The scene changed',
      })
    emitter.on('camera-controls:generate-thumbnail', fail)
    await expect(requestFrame('casa', 'viewport')).rejects.toThrow('The scene changed')
    emitter.off('camera-controls:generate-thumbnail', fail)
  })
})

describe('sceneIdFromPath', () => {
  test('reads the scene id from the project route, nothing else', async () => {
    const { sceneIdFromPath } = await import('./capture')
    expect(sceneIdFromPath('/project/akuared-sala')).toBe('akuared-sala')
    expect(sceneIdFromPath('/project/casa%20bianca/')).toBe('casa bianca')
    expect(sceneIdFromPath('/')).toBeNull()
    expect(sceneIdFromPath('/project/a/b')).toBeNull()
  })
})

describe('saveCapture', () => {
  test('sends the camera behind the frame with the scene it shows', async () => {
    const camera = {
      position: [1, 2, 3] as [number, number, number],
      quaternion: [0, 0, 0, 1] as [number, number, number, number],
      projection: 'perspective' as const,
      fov: 50,
    }
    const sent: FormData[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent.push(init.body as FormData)
      return Response.json({ capture: { image: 'i', sidecar: 's' } }, { status: 201 })
    }) as typeof fetch
    try {
      const scene = { id: 'casa', version: 3, sha256: 'a'.repeat(64) }
      const saved = await saveCapture({ blob: new Blob(['webp']), camera }, scene, 'viewport', [
        'level_p1',
      ])
      expect(saved).toEqual({
        id: sent[0]?.get('operation_id') as string,
        image: 'i',
        sidecar: 's',
      })
      await saveCapture({ blob: new Blob(['webp']) }, scene, 'viewport')
    } finally {
      globalThis.fetch = realFetch
    }
    expect(JSON.parse(sent[0]?.get('camera') as string)).toEqual(camera)
    expect(sent[1]?.get('camera')).toBeNull()
    expect(JSON.parse(sent[0]?.get('hidden_levels') as string)).toEqual(['level_p1'])
    expect(JSON.parse(sent[1]?.get('hidden_levels') as string)).toEqual([])
  })
})

describe('hiddenLevels', () => {
  test('follows the viewer: levels above the selected floor and author-hidden ones are out', async () => {
    const { useScene } = await import('@pascal-app/core')
    const { useViewer } = await import('@pascal-app/viewer')
    const { hiddenLevels } = await import('./capture')
    const level = (id: string, index: number, visible = true) => ({
      id,
      type: 'level',
      level: index,
      visible,
    })
    const nodes = {
      level_pt: level('level_pt', 0),
      level_p1: level('level_p1', 1),
      level_p2: level('level_p2', 2),
      level_cantina: level('level_cantina', -1, false),
    }
    const scene = useScene.getState()
    const viewer = useViewer.getState()
    useScene.setState({ nodes } as never)
    useViewer.setState({
      levelMode: 'stacked',
      hideLevelsAboveSelection: true,
      selection: { ...viewer.selection, levelId: 'level_pt' },
      levelsRevealing: [],
    } as never)
    try {
      expect(hiddenLevels().sort()).toEqual(['level_cantina', 'level_p1', 'level_p2'])
      useViewer.setState({ selection: { ...viewer.selection, levelId: null } } as never)
      expect(hiddenLevels()).toEqual(['level_cantina'])
    } finally {
      useScene.setState(scene)
      useViewer.setState(viewer)
    }
  })
})
