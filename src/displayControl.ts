import { getSupabase } from './cloudStorage'
import { createId } from './id'

export const HEARTBEAT_MS = 5 * 60_000
export const RECENT_MS = 11 * 60_000
export type DeviceState = 'pending' | 'enabled' | 'disabled'
export type DisplayDevice = {
  id: string
  organization_id: string
  name: string
  enabled: boolean | null
  last_seen_at: string
}
export type DeviceIdentity = { id: string; secret: string }

const verifiedKey = (organizationId: string) => `neutralpublisher-verified-v1:${organizationId}`

export function getLastVerifiedAt(organizationId: string, identity: DeviceIdentity): number {
  try {
    const saved = JSON.parse(localStorage.getItem(verifiedKey(organizationId)) || 'null') as { id?: string; at?: number } | null
    return saved?.id === identity.id && typeof saved.at === 'number' && saved.at <= Date.now() ? saved.at : 0
  } catch {
    return 0
  }
}

export function recordVerified(organizationId: string, identity: DeviceIdentity) {
  try {
    localStorage.setItem(verifiedKey(organizationId), JSON.stringify({ id: identity.id, at: Date.now() }))
  } catch {
    // The current tab remains authorized even if persistent storage is unavailable.
  }
}

export function clearVerified(organizationId: string) {
  try { localStorage.removeItem(verifiedKey(organizationId)) } catch { /* Storage may be unavailable. */ }
}

export function getDeviceIdentity(organizationId: string): DeviceIdentity {
  const key = `neutralpublisher-device-v1:${organizationId}`
  const saved = localStorage.getItem(key)
  if (saved) {
    const identity = JSON.parse(saved) as DeviceIdentity
    if (/^[a-f0-9-]{36}$/.test(identity.id) && /^[a-f0-9]{64}$/.test(identity.secret)) return identity
    throw new Error('Identidad de pantalla invalida.')
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const identity = { id: createId(), secret: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') }
  localStorage.setItem(key, JSON.stringify(identity))
  return identity
}

export async function heartbeat(organizationId: string, identity: DeviceIdentity, signal: AbortSignal): Promise<DeviceState> {
  const { data, error } = await getSupabase().rpc('display_heartbeat', {
    org_id: organizationId, device_id: identity.id, device_secret: identity.secret,
  }).abortSignal(signal)
  if (error) throw new Error(error.message)
  if (data !== 'enabled' && data !== 'disabled' && data !== 'pending') throw new Error('Respuesta de pantalla invalida.')
  return data
}

export async function listDisplayDevices(organizationId: string) {
  const { data, error } = await getSupabase().from('display_devices')
    .select('id, organization_id, name, enabled, last_seen_at')
    .eq('organization_id', organizationId).order('created_at')
  if (error) throw new Error(`No se pudieron consultar las pantallas: ${error.message}`)
  return data as DisplayDevice[]
}

export async function getDisplayControlEnabled(organizationId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('get_display_control_enabled', { org_id: organizationId })
  if (error || typeof data !== 'boolean') throw new Error(error?.message || 'No se pudo leer el control de pantallas.')
  return data
}

export async function setDisplayControlEnabled(organizationId: string, enabled: boolean): Promise<void> {
  const { data, error } = await getSupabase().rpc('set_display_control_enabled', {
    org_id: organizationId, control_enabled: enabled,
  })
  if (error || data !== enabled) throw new Error(error?.message || 'No se pudo cambiar el control de pantallas.')
}

export async function updateDisplayDevice(id: string, organizationId: string, changes: { name?: string; enabled?: boolean }) {
  const { data, error } = await getSupabase().from('display_devices').update(changes)
    .eq('id', id).eq('organization_id', organizationId).select('id').single()
  if (error || !data) throw new Error(error?.message || 'No tienes permisos para administrar esta pantalla.')
}
