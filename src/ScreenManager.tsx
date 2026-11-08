import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, MonitorPlay, Power, RefreshCw, Save } from 'lucide-react'
import { getDisplayControlEnabled, HEARTBEAT_MS, RECENT_MS, listDisplayDevices, setDisplayControlEnabled, updateDisplayDevice, type DisplayDevice } from './displayControl'

function DeviceRow({ device, busy, now, onSave }: {
  device: DisplayDevice
  busy: boolean
  now: number
  onSave: (id: string, changes: { name?: string; enabled?: boolean }) => Promise<void>
}) {
  const [name, setName] = useState(device.name)
  const recent = now - Date.parse(device.last_seen_at) < RECENT_MS
  const status = device.enabled === null ? 'Pendiente' : !device.enabled ? 'Desactivada' : recent ? 'Conexion reciente' : 'Sin conexion reciente'
  return <li className="screen-row">
    <div className="screen-name">
      <input aria-label={`Nombre de ${device.name}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <button className="icon-button" title="Guardar nombre" aria-label="Guardar nombre" disabled={busy || !name.trim() || name.trim() === device.name}
        onClick={() => void onSave(device.id, { name: name.trim() })}><Save size={18} /></button>
    </div>
    <div className="screen-status"><strong>{status}</strong><small>{device.id.slice(0, 8)} · {new Date(device.last_seen_at).toLocaleString('es')}</small></div>
    <button className="icon-button labeled" disabled={busy} onClick={() => {
      if (device.enabled && !window.confirm(`Desactivar ${device.name}? El visor se detendra en su proxima comprobacion.`)) return
      void onSave(device.id, { enabled: !device.enabled })
    }}>
      {device.enabled ? <Power size={18} /> : <Check size={18} />}
      <span>{device.enabled === null ? 'Autorizar' : device.enabled ? 'Desactivar' : 'Reactivar'}</span>
    </button>
  </li>
}

export function ScreenManager({ organizationId, authenticated }: { organizationId: string; authenticated: boolean }) {
  const [devices, setDevices] = useState<DisplayDevice[]>([])
  const [controlStatus, setControlStatus] = useState<{ organizationId: string; enabled: boolean } | null>(null)
  const controlEnabled = controlStatus?.organizationId === organizationId ? controlStatus.enabled : null
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const mounted = useRef(true)
  const loading = useRef(false)
  const refresh = useCallback(async () => {
    if (loading.current) return
    loading.current = true
    setBusy(true)
    setNow(Date.now())
    try {
      const rows = await listDisplayDevices(organizationId)
      let enabled: boolean | null = null
      let modeError = ''
      try {
        enabled = await getDisplayControlEnabled(organizationId)
      } catch (error) {
        modeError = error instanceof Error ? error.message : 'No se pudo consultar el interruptor.'
      }
      if (mounted.current) {
        setDevices(rows)
        setControlStatus(enabled === null ? null : { organizationId, enabled })
        setMessage(modeError)
        setNow(Date.now())
      }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'No se pudieron consultar las pantallas.')
    } finally {
      loading.current = false
      if (mounted.current) setBusy(false)
    }
  }, [organizationId])

  useEffect(() => {
    mounted.current = true
    if (!organizationId || !authenticated) return
    // Load after mount; do not poll when the admin tab is hidden.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const interval = window.setInterval(() => { if (!document.hidden) void refresh() }, HEARTBEAT_MS)
    return () => { mounted.current = false; window.clearInterval(interval) }
  }, [authenticated, organizationId, refresh])

  const save = async (id: string, changes: { name?: string; enabled?: boolean }) => {
    setBusy(true)
    try {
      await updateDisplayDevice(id, organizationId, changes)
      if (!mounted.current) return
      setDevices((rows) => rows.map((row) => row.id === id ? { ...row, ...changes } : row))
      setMessage(changes.enabled !== undefined ? 'Orden guardada. Se aplicara en la proxima comprobacion (aprox. 5 minutos).' : 'Nombre guardado.')
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const toggleControl = async (enabled: boolean) => {
    if (!enabled && !window.confirm('Al desactivar el control, cualquier persona con el enlace de esta empresa podra ver su publicidad sin autorizacion. ¿Continuar?')) return
    setBusy(true)
    try {
      await setDisplayControlEnabled(organizationId, enabled)
      if (!mounted.current) return
      setControlStatus({ organizationId, enabled })
      setMessage(enabled ? 'Control activado. Las pantallas nuevas necesitaran autorizacion.' : 'Control desactivado. El visor abrira sin codigo en su proxima comprobacion.')
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'No se pudo cambiar el control de pantallas.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const recentCount = devices.filter((d) => d.enabled && now - Date.parse(d.last_seen_at) < RECENT_MS).length
  return <section className="screen-manager">
    <div className="library-heading">
      <div className="panel-heading"><MonitorPlay size={20} /><h2>Pantallas</h2></div>
      {organizationId && authenticated && <button className="icon-button" title="Actualizar pantallas" aria-label="Actualizar pantallas" disabled={busy} onClick={() => void refresh()}><RefreshCw size={18} /></button>}
    </div>
    {!authenticated ? <p>Inicia sesion para administrar las pantallas.</p> : !organizationId ? <p>Selecciona una empresa. Los visores sin empresa no tienen control remoto.</p> : <>
      <label className="screen-control-toggle">
        <span>Control de pantallas</span>
        <input type="checkbox" role="switch" checked={controlEnabled ?? true} disabled={busy || controlEnabled === null}
          onChange={(event) => void toggleControl(event.target.checked)} />
      </label>
      {controlEnabled === false ? <p>Desactivado: las pantallas con el enlace de esta empresa no necesitan autorizacion.</p> : <>
        <p>{recentCount} autorizadas con conexion reciente · {devices.length} registradas</p>
        {devices.length ? <ul className="screen-list">{devices.map((d) => <DeviceRow key={d.id} device={d} busy={busy} now={now} onSave={save} />)}</ul> : <p>{busy ? 'Consultando pantallas...' : 'Sin pantallas registradas.'}</p>}
      </>}
      {message && <p className="status-message" role="status">{message}</p>}
    </>}
  </section>
}
