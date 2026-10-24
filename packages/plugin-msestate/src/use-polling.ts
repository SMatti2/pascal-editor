import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from './http'

const POLL_MS = 5000

/**
 * A server list polled while the panel is open, so results saved by Antigravity or Blender appear
 * by themselves. `load` must be stable (useCallback); null loads nothing.
 */
export function usePolling<T>(load: (() => Promise<T[]>) | null) {
  const [items, setItems] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!load) return
    try {
      setItems(await load())
      setError(null)
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }, [load])

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  return { items, error, refresh }
}
