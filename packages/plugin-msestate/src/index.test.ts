import { describe, expect, test } from 'bun:test'
import { fotoHostPanel, notesHostPanel, piantaHostPanel } from './index'

describe('our rail panels', () => {
  test('are host UI, not managed plugins: always on the rail; Foto keeps the Studio id', () => {
    expect(fotoHostPanel.id).toBe('msestate:studio')
    for (const panel of [fotoHostPanel, piantaHostPanel, notesHostPanel])
      expect(panel.pluginId).toBeUndefined()
  })
  test('load their components lazily', async () => {
    for (const panel of [fotoHostPanel, piantaHostPanel, notesHostPanel])
      expect(typeof (await panel.component()).default).toBe('function')
  })
})
