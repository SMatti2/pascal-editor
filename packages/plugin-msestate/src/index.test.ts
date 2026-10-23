import { describe, expect, test } from 'bun:test'
import { studioHostPanel } from './index'

describe('studioHostPanel', () => {
  test('is host UI, not a managed plugin: always on the rail', () => {
    expect(studioHostPanel.id).toBe('msestate:studio')
    expect(studioHostPanel.pluginId).toBeUndefined()
  })
  test('loads its component lazily', async () => {
    const mod = await studioHostPanel.component()
    expect(typeof mod.default).toBe('function')
  })
})
