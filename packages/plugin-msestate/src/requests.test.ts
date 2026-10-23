import { afterEach, describe, expect, test } from 'bun:test'
import { thumbnailUrl } from './http'
import { copyWhenReady, createRequest, listRequests } from './requests'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const answer = (status: number, body: unknown) => {
  const calls: { url: string; init?: RequestInit }[] = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return Response.json(body, { status })
  }) as typeof fetch
  return calls
}

describe('render requests', () => {
  test('a request is posted as JSON for the scene and comes back prepared', async () => {
    const prepared = { id: 'r1', prompt: 'p', instructions: 'i' }
    const calls = answer(201, { request: prepared })
    const oak = { relative: 'refs/rovere.png', role: 'material' as const, target: 'pavimento' }
    expect(await createRequest('casa bianca', 'cap-1', 'luce calda', [oak])).toEqual(prepared)
    expect(calls[0]?.url).toBe('/api/projects/casa%20bianca/pascal/requests')
    expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({
      capture: 'cap-1',
      appearance: 'luce calda',
      references: [oak],
    })
  })

  test("the server's refusal is the error shown", async () => {
    answer(404, { error: 'Cattura non trovata' })
    await expect(createRequest('casa', 'x', '', [])).rejects.toThrow('Cattura non trovata')
    answer(500, {})
    await expect(listRequests('casa')).rejects.toThrow('Richieste non disponibili (500)')
  })

  test('results show through the thumbnail route', () => {
    expect(thumbnailUrl('casa', 'model/render/pascal/requests/r1/result.png', 384)).toBe(
      '/api/projects/casa/thumbnails?path=model%2Frender%2Fpascal%2Frequests%2Fr1%2Fresult.png&width=384',
    )
  })
})

describe('copyWhenReady', () => {
  const clipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard')
  afterEach(() => {
    if (clipboard) Object.defineProperty(globalThis.navigator, 'clipboard', clipboard)
  })

  test('copies the text once it arrives', async () => {
    const written: string[] = []
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => written.push(text) },
    })
    await copyWhenReady(Promise.resolve('istruzioni'))
    expect(written).toEqual(['istruzioni'])
  })
})
