import { useEffect, useState, type ReactNode } from 'react'
import { MonitorOff } from 'lucide-react'
import { getDeviceIdentity, heartbeat, HEARTBEAT_MS, type DeviceState } from './displayControl'

export function DisplayAccess({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const [state, setState] = useState<DeviceState | 'checking' | 'error'>('checking')
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    let timer: number | undefined
    let request: AbortController | undefined
    const check = async () => {
      request = new AbortController()
      const timeout = window.setTimeout(() => request?.abort(), 15_000)
      try {
        const identity = getDeviceIdentity(organizationId)
        const next = await heartbeat(organizationId, identity, request.signal)
        if (!cancelled) {
          setCode(identity.id.slice(0, 8))
          setState(next)
        }
      } catch {
        // Never mount the media player without a current authorization, including after reload.
        if (!cancelled) setState('error')
      } finally {
        window.clearTimeout(timeout)
        if (!cancelled) timer = window.setTimeout(() => void check(), HEARTBEAT_MS)
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
