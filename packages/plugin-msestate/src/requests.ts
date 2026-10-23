import { projectApi, replyOf } from './http'

/** A render request our server froze for Antigravity, with the results saved beside it. */
export type RenderRequest = {
  id: string
  created_at: string
  capture: string
  appearance: string
  references: { path: string; role: ReferenceChoice['role']; target?: string }[]
  results: string[]
}

export type PreparedRequest = { id: string; prompt: string; instructions: string }

/** A reference picked for a request: mood (`appearance`) or a finish for one named target (`material`). */
export type ReferenceChoice = {
  relative: string
  role: 'appearance' | 'material'
  target?: string
}

const api = (sceneId: string) => `${projectApi(sceneId)}/pascal/requests`

/** Freeze a request from a saved capture; the server writes the prompt and the instructions. */
export async function createRequest(
  sceneId: string,
  capture: string,
  appearance: string,
  references: ReferenceChoice[],
): Promise<PreparedRequest> {
  const response = await fetch(api(sceneId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ capture, appearance, references }),
  })
  return (await replyOf<{ request: PreparedRequest }>(response, 'Richiesta non creata')).request
}

export async function listRequests(sceneId: string): Promise<RenderRequest[]> {
  const response = await fetch(api(sceneId), { cache: 'no-store' })
  return (await replyOf<{ requests: RenderRequest[] }>(response, 'Richieste non disponibili'))
    .requests
}

/**
 * Copy text that is still being fetched. The promise goes into the ClipboardItem so the copy
 * keeps the click's user activation (Safari drops it across an await).
 */
export async function copyWhenReady(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = text.then((value) => new Blob([value], { type: 'text/plain' }))
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
    return
  }
  await navigator.clipboard.writeText(await text)
}
