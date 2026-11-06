import { useScene } from '@pascal-app/core'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { timeSpan } from '../../lib/perf-tracks'
import useViewer from '../../store/use-viewer'

/**
 * msestate: a still scene does not need 50 full frames a second (each runs the whole
 * post-processing chain). After IDLE_AFTER_MS with no input and no scene or viewer change
 * the loop drops to IDLE_FPS, so temporal effects still settle; the next event restores it.
 */
export const IDLE_AFTER_MS = 3000
export const IDLE_FPS = 5
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'resize'] as const

export function frameIntervalMs(fps: number, now: number, lastActive: number): number {
  return 1000 / (now - lastActive > IDLE_AFTER_MS ? Math.min(fps, IDLE_FPS) : fps)
}

type FrameLimiterProps = {
  fps?: number
  paused?: boolean
  onFrameError?: (cause: unknown) => void
}

export type FrameClock = {
  sample: (wallTimeMs: number, intervalMs: number) => number | null
  step: (seconds: number) => number
}

/**
 * Keeps R3F's manual clock monotonic while each limiter effect owns a fresh
 * wall-time baseline. The first rAF sample establishes that baseline instead
 * of treating the browser's process uptime as elapsed frame time.
 */
export function createFrameClock(initialTime = 0): FrameClock {
  let frameTime = initialTime
  let previousWallTime: number | null = null

  return {
    sample(wallTimeMs, intervalMs) {
      if (previousWallTime === null) {
        previousWallTime = wallTimeMs
        return null
      }

      const elapsedMs = wallTimeMs - previousWallTime
      if (elapsedMs < intervalMs) return null

      const remainderMs = elapsedMs % intervalMs
      frameTime += (elapsedMs - remainderMs) / 1000
      previousWallTime = wallTimeMs - remainderMs
      return frameTime
    },
    step(seconds) {
      frameTime += seconds
      return frameTime
    },
  }
}

// `?disable=draw` (see post-processing.tsx): the page renders no real frames,
// and Chromium's no-damage scheduler then throttles requestAnimationFrame to
// 1Hz on Linux (measured in the headless bake worker — every useFrame system
// ticked once per second and a heavy scene took 300+ seconds to settle). A
// plain timer is never throttled on a visible page, so drive the loop with
// setInterval instead of rAF when nothing is drawn.
const DRAW_DISABLED =
  typeof window !== 'undefined' &&
  new Set(
    (new URLSearchParams(window.location.search).get('disable') ?? '')
      .split(',')
      .map((s) => s.trim()),
  ).has('draw')

const FrameLimiter: React.FC<FrameLimiterProps> = ({ fps = 50, paused = false, onFrameError }) => {
  const { advance: advanceFrame, set, frameloop: initFrameloop } = useThree()
  const onFrameErrorRef = useRef(onFrameError)
  onFrameErrorRef.current = onFrameError
  const nextFrameTimeRef = useRef(0)
  const renderer = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)
  // Fully covered canvas (e.g. studio gallery) → stop advancing frames
  const renderPaused = useViewer((s) => s.renderPaused)

  useLayoutEffect(() => {
    if (renderPaused || paused) return
    const clock = createFrameClock(nextFrameTimeRef.current)
    let raf: number | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let sizeSynced = false
    // A system that throws inside useFrame runs outside React's error
    // boundaries: report the first failure to the host and keep the loop alive.
    let frameErrorReported = false
    function advance(frameTime: number) {
      try {
        advanceFrame(frameTime)
      } catch (error) {
        if (frameErrorReported) return
        frameErrorReported = true
        if (onFrameErrorRef.current) onFrameErrorRef.current(error)
        else console.error('[viewer] a frame callback threw', error)
      }
    }
    const effectiveFps = Number.isFinite(fps) && fps > 0 ? fps : 50
    const interval = 1000 / effectiveFps
    let lastActive = performance.now()
    const markActive = () => {
      lastActive = performance.now()
    }
    function syncSize() {
      if (sizeSynced) return
      renderer.setPixelRatio(dpr)
      renderer.setSize(size.width, size.height, false)
      sizeSynced = true
    }
    function tick(t: DOMHighResTimeStamp) {
      raf = requestAnimationFrame(tick)
      syncSize()
      const frameTime = clock.sample(t, frameIntervalMs(effectiveFps, t, lastActive))
      if (frameTime === null) return
      nextFrameTimeRef.current = frameTime
      timeSpan('frame-cpu', () => advance(frameTime))
    }
    function kick() {
      syncSize()
      const frameTime = clock.step(1 / 1000)
      nextFrameTimeRef.current = frameTime
      timeSpan('frame-cpu', () => advance(frameTime))
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') kick()
    }
    // Set frameloop to never, it will shut down the default render loop
    set({ frameloop: 'never' })
    if (DRAW_DISABLED) {
      timer = setInterval(() => {
        const frameTime = clock.step(interval / 1000)
        nextFrameTimeRef.current = frameTime
        timeSpan('frame-cpu', () => advance(frameTime))
      }, interval)
    } else {
      // Kick off custom render loop
      raf = requestAnimationFrame(tick)
      for (const event of ACTIVITY_EVENTS)
        window.addEventListener(event, markActive, { passive: true })
      // rAF can stall while a tab is hidden, unfocused, or occluded. With the
      // default loop disabled, force one current frame as soon as it resumes.
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('focus', kick)
      window.addEventListener('pageshow', kick)
    }
    const unsubscribeScene = useScene.subscribe(markActive)
    const unsubscribeViewer = useViewer.subscribe(markActive)
    // Restore initial setting
    return () => {
      unsubscribeScene()
      unsubscribeViewer()
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive)
      if (raf) {
        cancelAnimationFrame(raf)
      }
      if (timer) {
        clearInterval(timer)
      }
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', kick)
      window.removeEventListener('pageshow', kick)
      set({ frameloop: initFrameloop })
    }
  }, [
    advanceFrame,
    dpr,
    fps,
    initFrameloop,
    paused,
    renderPaused,
    renderer,
    set,
    size.height,
    size.width,
  ])

  return null
}

export default FrameLimiter
