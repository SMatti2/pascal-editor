import { describe, expect, test } from 'bun:test'
import { emitter, type ThumbnailGenerateEvent } from '@pascal-app/core'
import { requestFrame } from './view'

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
    const frame = await requestFrame('casa')
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
    await expect(requestFrame('casa')).rejects.toThrow('The scene changed')
    emitter.off('camera-controls:generate-thumbnail', fail)
  })
})

describe('hiddenLevels', () => {
  test('follows the viewer: levels above the selected floor and author-hidden ones are out', async () => {
    const { useScene } = await import('@pascal-app/core')
    const { useViewer } = await import('@pascal-app/viewer')
    const { hiddenLevels } = await import('./view')
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
