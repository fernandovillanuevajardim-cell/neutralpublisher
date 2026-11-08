import { useEffect, useState, type ReactNode } from 'react'
import { MonitorOff } from 'lucide-react'
import { clearVerified, getDeviceIdentity, getLastVerifiedAt, heartbeat, HEARTBEAT_MS, recordVerified, type DeviceState } from './displayControl'

export const OFFLINE_GRACE_MS = 30 * 60_000
const retryDelay = (failures: number) => Math.min(15_000 * 2 ** Math.min(failures - 1, 2), 60_000)

export function DisplayAccess({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const [state, setState] = useState<DeviceState | 'checking' | 'error'>(() => {
    try {
      if (organizationId && Date.now() - getLastVerifiedAt(organizationId, getDeviceIdentity(organizationId)) <= OFFLINE_GRACE_MS) return 'enabled'
    } catch { /* The heartbeat will report an identity problem. */ }
    return 'checking'
  })
  const [code, setCode] = useState('')
  const [errorDetail, setErrorDetail] = useState('')

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
      let phase: 'identity' | 'control' = 'identity'
      try {
        const identity = getDeviceIdentity(organizationId)
        lastEnabledAt ||= getLastVerifiedAt(organizationId, identity)
        if (!cancelled) setCode(identity.id.slice(0, 8))
        phase = 'control'
        const next = await heartbeat(organizationId, identity, request.signal)
        if (!cancelled) {
          failures = 0
          if (next === 'enabled') {
            lastEnabledAt = Date.now()
            recordVerified(organizationId, identity)
          } else {
            lastEnabledAt = 0
            clearVerified(organizationId)
          }
          setErrorDetail('')
          setState(next)
        }
      } catch (error) {
        if (!cancelled) {
          failures += 1
          delay = retryDelay(failures)
          const detail = phase === 'identity' ? 'No se pudo recuperar la identidad guardada.' : error instanceof Error ? error.message : 'Error de conexion.'
          const organizationUnavailable = phase === 'control' && /organization unavailable/i.test(detail)
          setErrorDetail(organizationUnavailable ? 'Esta organizacion ya no existe. Usa un enlace nuevo desde el administrador.' : detail)
          if (organizationUnavailable) {
            lastEnabledAt = 0
            clearVerified(organizationId)
          }
          if (organizationUnavailable || !lastEnabledAt || Date.now() - lastEnabledAt > OFFLINE_GRACE_MS) setState('error')
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
        {state === 'error' && errorDetail && <p>{errorDetail}</p>}
      </>}
    </main>
  )
}
