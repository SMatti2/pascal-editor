import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from './http'
import { listRequests, type RenderRequest } from './requests'

const POLL_MS = 5000

/** The scene's render requests, polled while the panel is open: Antigravity's results appear by themselves. */
export function useRequests(sceneId: string | null) {
  const [requests, setRequests] = useState<RenderRequest[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!sceneId) return
    try {
      setRequests(await listRequests(sceneId))
      setError(null)
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }, [sceneId])

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  return { requests, error, refresh }
}
