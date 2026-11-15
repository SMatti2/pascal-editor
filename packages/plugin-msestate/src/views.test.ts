import { afterEach, expect, test } from 'bun:test'
import { emitter, type ThumbnailGenerateEvent } from '@pascal-app/core'
import { fovOf, lensOf, poseOf, shootViews, type View } from './views'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const CAMERA = {
  position: [1, 1.6, 4] as [number, number, number],
  quaternion: [0, 0, 0, 1] as [number, number, number, number],
  projection: 'perspective' as const,
  fov: 50,
}
const VIEW: View = {
  id: 'v1',
  name: 'Soggiorno',
  capture: 'old',
  image: 'model/render/pascal/captures/old.webp',
  camera: CAMERA,
  hidden_levels: ['level_p1'],
  width: 1600,
  height: 900,
  scene_sha256: 'a'.repeat(64),
  captured_at: '2026-11-14T10:00:00Z',
}

test('only a perspective camera can be shot again', () => {
  expect(poseOf(CAMERA)).toEqual({ position: [1, 1.6, 4], quaternion: [0, 0, 0, 1], fov: 50 })
  expect(() =>
    poseOf({ ...CAMERA, projection: 'orthographic', fov: undefined, viewHeight: 8 }),
  ).toThrow(/prospettica/)
})

test('a view is shot again from its own camera and size, inside one capture session', async () => {
  const sessions: boolean[] = []
  const asked: ThumbnailGenerateEvent[] = []
  const onSession = ({ active }: { active: boolean }) => sessions.push(active)
  const answer = (event: ThumbnailGenerateEvent) => {
    asked.push(event)
    emitter.emit('snapshot:captured', {
      requestId: event.requestId as string,
      blob: new Blob(['webp']),
      width: 1600,
      height: 900,
    })
  }
  const posted: { url: string; body: unknown }[] = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return new Response(null, { headers: { etag: '"7"' } })
    posted.push({ url, body: init?.body })
    if (url.endsWith('/captures'))
      return Response.json({ capture: { image: 'x.webp', sidecar: 'x.json' } }, { status: 201 })
    return Response.json({ views: [{ ...VIEW, capture: 'new' }] })
  }) as typeof fetch
  emitter.on('camera-controls:capture-session', onSession)
  emitter.on('camera-controls:generate-thumbnail', answer)
  try {
    const after = await shootViews('default', 'casa', [VIEW])
    expect(after[0]?.capture).toBe('new')
  } finally {
    emitter.off('camera-controls:capture-session', onSession)
    emitter.off('camera-controls:generate-thumbnail', answer)
  }
  expect(sessions).toEqual([true, false])
  expect(asked[0]).toMatchObject({
    captureMode: 'standard',
    cameraPose: { position: [1, 1.6, 4], quaternion: [0, 0, 0, 1], fov: 50 },
    standardSize: { w: 1600, h: 900 },
    ephemeral: true,
  })
  const capture = posted[0]?.body as FormData
  expect(JSON.parse(capture.get('camera') as string)).toEqual(CAMERA)
  expect(JSON.parse(capture.get('hidden_levels') as string)).toEqual(['level_p1'])
  const shoot = JSON.parse(posted[1]?.body as string)
  expect(shoot).toEqual({ action: 'shoot', id: 'v1', capture: capture.get('operation_id') })
})

test('a lens is the full-frame focal length of the horizontal angle of the view', () => {
  const view = {
    camera: { ...CAMERA, fov: fovOf(24, { width: 1536, height: 1024 }) },
    width: 1536,
    height: 1024,
  }
  expect(lensOf(view)).toBeCloseTo(24, 6)
  // across a 36 mm wide frame a 24 mm lens sees 2·atan(18 / 24) = 73.74°
  const across = 2 * Math.atan(Math.tan((view.camera.fov * Math.PI) / 360) * 1.5)
  expect((across * 180) / Math.PI).toBeCloseTo(73.74, 2)
  expect(lensOf({ ...view, camera: { ...CAMERA, fov: fovOf(14, view) } })).toBeCloseTo(14, 6)
})
