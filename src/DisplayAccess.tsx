import { useEffect, useState, type ReactNode } from 'react'
import { MonitorOff } from 'lucide-react'
import { getDeviceIdentity, heartbeat, HEARTBEAT_MS, type DeviceState } from './displayControl'

export const OFFLINE_GRACE_MS = 30 * 60_000
const retryDelay = (failures: number) => Math.min(15_000 * 2 ** Math.min(failures - 1, 2), 60_000)

export function DisplayAccess({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const [state, setState] = useState<DeviceState | 'checking' | 'error'>('checking')
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    let timer: number | undefined
    let request: AbortController | undefined
    let lastEnabledAt = 0
    let failures = 0
    const check = async () => {
      request = new AbortController()
      const timeout = window.setTimeout(() => request?.abort(), 15_000)
      let delay = HEARTBEAT_MS
      try {
        const identity = getDeviceIdentity(organizationId)
        const next = await heartbeat(organizationId, identity, request.signal)
        if (!cancelled) {
          failures = 0
          if (next === 'enabled') lastEnabledAt = Date.now()
          else lastEnabledAt = 0
          setCode(identity.id.slice(0, 8))
          setState(next)
        }
      } catch {
        if (!cancelled) {
          failures += 1
          delay = retryDelay(failures)
          // A previously authorized screen keeps its current slide during a brief outage.
          if (!lastEnabledAt || Date.now() - lastEnabledAt > OFFLINE_GRACE_MS) setState('error')
        }
      } finally {
        window.clearTimeout(timeout)
        if (!cancelled) timer = window.setTimeout(() => void check(), delay)
      }
    }
    void check()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      request?.abort()
    }
  }, [organizationId])

  if (!organizationId || state === 'enabled') return children
  return (
    <main className="display-access" aria-live="polite">
      {state !== 'checking' && <>
        <MonitorOff size={28} />
        <h1>{state === 'disabled' ? 'Pantalla desactivada' : state === 'pending' ? 'Pantalla pendiente de autorizacion' : 'Sin conexion con el control de pantallas'}</h1>
        {code && <p>Pantalla {code}</p>}
      </>}
    </main>
  )
}
