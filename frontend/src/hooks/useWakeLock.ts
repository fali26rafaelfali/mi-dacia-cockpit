import { useCallback, useEffect, useRef, useState } from 'react'

interface WakeLockSentinelLike extends EventTarget {
  released: boolean
  release(): Promise<void>
}

type WakeLockNavigator = Navigator & {
  wakeLock: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
}

export function useWakeLock(enabled = false) {
  const sentinel = useRef<WakeLockSentinelLike | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  const release = useCallback(async () => {
    const current = sentinel.current
    sentinel.current = null
    if (current && !current.released) await current.release()
    setActive(false)
  }, [])

  const request = useCallback(async () => {
    if (!supported || document.visibilityState !== 'visible') return false
    try {
      const lock = await (navigator as WakeLockNavigator).wakeLock?.request('screen')
      if (!lock) return false
      sentinel.current = lock
      lock.addEventListener('release', () => setActive(false), { once: true })
      setActive(true)
      setError(null)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error(String(reason)))
      return false
    }
  }, [supported])

  useEffect(() => {
    if (!enabled) {
      void release()
      return
    }
    void request()
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel.current) void request()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void release()
    }
  }, [enabled, release, request])

  return { supported, active, error, request, release }
}
