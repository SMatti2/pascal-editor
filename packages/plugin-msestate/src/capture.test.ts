import { describe, expect, test } from 'bun:test'
import { saveCapture } from './capture'

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
      const saved = await saveCapture({ blob: new Blob(['webp']), camera }, scene, ['level_p1'])
      expect(saved).toEqual({
        id: sent[0]?.get('operation_id') as string,
        image: 'i',
        sidecar: 's',
      })
      await saveCapture({ blob: new Blob(['webp']) }, scene)
    } finally {
      globalThis.fetch = realFetch
    }
    expect(JSON.parse(sent[0]?.get('camera') as string)).toEqual(camera)
    expect(sent[1]?.get('camera')).toBeNull()
    expect(JSON.parse(sent[0]?.get('hidden_levels') as string)).toEqual(['level_p1'])
    expect(JSON.parse(sent[1]?.get('hidden_levels') as string)).toEqual([])
  })
})
