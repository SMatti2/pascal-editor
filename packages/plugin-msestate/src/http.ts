/** Our server's API for one project, reached through the editor's own origin (Tailscale path route). */
export const projectApi = (sceneId: string) => `/api/projects/${encodeURIComponent(sceneId)}`

/** The JSON reply, or the server's own error message when it refused. */
export async function replyOf<T>(response: Response, fallback: string): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `${fallback} (${response.status})`)
  return body
}

/** A project image through our server's thumbnail route (192, 384, 768 or 1920 px wide). */
export const thumbnailUrl = (sceneId: string, path: string, width: 192 | 384 | 768 | 1920) =>
  `${projectApi(sceneId)}/thumbnails?${new URLSearchParams({ path, width: String(width) })}`

/** What to show for a failure: its message, or the value itself. */
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
