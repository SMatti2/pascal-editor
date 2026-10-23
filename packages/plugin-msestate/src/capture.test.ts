import { describe, expect, test } from 'bun:test'
import { emitter, type ThumbnailGenerateEvent } from '@pascal-app/core'
import { requestFrame } from './capture'

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
