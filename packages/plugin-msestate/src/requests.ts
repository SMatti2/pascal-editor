/** A render request our server froze for Antigravity, with the results saved beside it. */
export type RenderRequest = {
  id: string
  created_at: string
  capture: string
  appearance: string
  results: string[]
}

export type PreparedRequest = { id: string; prompt: string; instructions: string }

const api = (sceneId: string) => `/api/projects/${encodeURIComponent(sceneId)}/pascal/requests`

async function json<T>(response: Response, fallback: string): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `${fallback} (${response.status})`)
  return body
}

/** Freeze a request from a saved capture; the server writes the prompt and the instructions. */
export async function createRequest(
  sceneId: string,
  capture: string,
  appearance: string,
): Promise<PreparedRequest> {
  const response = await fetch(api(sceneId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ capture, appearance }),
  })
  return (await json<{ request: PreparedRequest }>(response, 'Richiesta non creata')).request
}

export async function listRequests(sceneId: string): Promise<RenderRequest[]> {
  const response = await fetch(api(sceneId), { cache: 'no-store' })
  return (await json<{ requests: RenderRequest[] }>(response, 'Richieste non disponibili')).requests
}

/** A project image through our server's thumbnail route (192, 384 or 768 px wide). */
export const thumbnailUrl = (sceneId: string, path: string, width: 192 | 384 | 768) =>
  `/api/projects/${encodeURIComponent(sceneId)}/thumbnails?${new URLSearchParams({ path, width: String(width) })}`

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
