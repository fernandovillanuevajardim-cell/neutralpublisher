import {
  ArrowDown,
  ArrowUp,
  Building2,
  CloudSun,
  X,
  Copy,
  Download,
  ExternalLink,
  FileImage,
  FileUp,
  Eye,
  CloudUpload,
  Home,
  ImagePlus,
  Link,
  Maximize,
  MonitorPlay,
  Plus,
  QrCode,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  addFiles,
  addRemoteMedia,
  deleteAllMedia,
  deleteMedia,
  exportRemotePlaylist,
  getAllMedia,
  getMediaBlob,
  loadDisplayBaseUrl,
  loadKioskMode,
  loadOrganizationId,
  loadRemotePlaylistUrl,
  loadSettings,
  replaceWithRemotePlaylist,
  saveDisplayBaseUrl,
  saveKioskMode,
  saveOrganizationId,
  saveOrder,
  saveRemotePlaylistUrl,
  saveSettings,
  updateMediaItem,
} from './storage'
import {
  createOrganization,
  getChannelPlaylistUrl,
  getCloudUser,
  isCloudStorageConfigured,
  listOrganizations,
  publishChannelPlaylistToCloud,
  publishJsonToCloud,
  signInCloudUser,
  signOutCloudUser,
  uploadFilesToCloud,
  uploadMediaToCloud,
  type Organization,
} from './cloudStorage'
import { fetchRemotePlaylist, parseRemotePlaylist } from './playlist'
import { convertPdfToPngFiles, type PdfConvertQuality } from './pdfTools'
import type { MediaItem, MediaItemWithPreview, PublisherSettings, TransitionName } from './types'

const transitions: Array<{ value: TransitionName; label: string }> = [
  { value: 'fade', label: 'Fade' },
  { value: 'slide-x', label: 'Slide X' },
  { value: 'slide-y', label: 'Slide Y' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'flip', label: 'Flip' },
  { value: 'blur', label: 'Blur' },
]

const getHashRoute = () => {
  const hash = window.location.hash.replace('#', '') || '/home'
  return hash.split('?')[0] || '/home'
}

const getHashParams = () => {
  const query = window.location.hash.split('?')[1]

  if (!query) {
    return new URLSearchParams()
  }

  return new URLSearchParams(query)
}

const getHashPlaylistUrl = () => {
  return getHashParams().get('playlist') ?? ''
}

const getHashKioskMode = () => {
  const value = getHashParams().get('kiosk')
  return value === '1' || value === 'true'
}

const getHashOrganizationId = () => {
  return getHashParams().get('org') ?? ''
}

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/$/, '')

const buildDisplayUrl = (playlistUrl: string, displayBaseUrl: string, kioskMode = false, organizationId = '') => {
  const origin = normalizeBaseUrl(displayBaseUrl) || window.location.origin
  const base = `${origin}${window.location.pathname}#/display`
  const url = playlistUrl.trim()
  const params = new URLSearchParams()

  if (url) {
    params.set('playlist', url)
  }

  if (kioskMode) {
    params.set('kiosk', '1')
  }

  if (organizationId) {
    params.set('org', organizationId)
  }

  const query = params.toString()
  return query ? `${base}?${query}` : base
}

const getSamplePlaylistUrl = (displayBaseUrl: string) => {
  const origin = normalizeBaseUrl(displayBaseUrl) || window.location.origin
  return `${origin}${window.location.pathname}sample-playlist.json`
}

const getDefaultDisplayPlaylistUrl = (organizationId?: string) => getChannelPlaylistUrl('principal', organizationId)

const formatBytes = (bytes: number) => {
  if (!bytes) {
    return 'URL'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }

  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

type WeatherSnapshot = {
  city: string
  temperature: number
  label: string
}

const weatherLabels: Record<number, string> = {
  0: 'Despejado',
  1: 'Mayormente claro',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla',
  51: 'Llovizna',
  53: 'Llovizna',
  55: 'Llovizna',
  61: 'Lluvia',
  63: 'Lluvia',
  65: 'Lluvia fuerte',
  71: 'Nieve',
  73: 'Nieve',
  75: 'Nieve fuerte',
  80: 'Chaparrones',
  81: 'Chaparrones',
  82: 'Chaparrones fuertes',
  95: 'Tormenta',
  96: 'Tormenta',
  99: 'Tormenta fuerte',
}

const getWeatherLabel = (code: number) => weatherLabels[code] ?? 'Clima'

const fetchWeather = async (city: string): Promise<WeatherSnapshot | null> => {
  const cleanCity = city.trim()

  if (!cleanCity) {
    return null
  }

  const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
  geocodeUrl.searchParams.set('name', cleanCity)
  geocodeUrl.searchParams.set('count', '1')
  geocodeUrl.searchParams.set('language', 'es')
  geocodeUrl.searchParams.set('format', 'json')

  const geocodeResponse = await fetch(geocodeUrl, { cache: 'force-cache' })

  if (!geocodeResponse.ok) {
    return null
  }

  const geocode = (await geocodeResponse.json()) as {
    results?: Array<{ latitude: number; longitude: number; name: string }>
  }
  const place = geocode.results?.[0]

  if (!place) {
    return null
  }

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
  forecastUrl.searchParams.set('latitude', String(place.latitude))
  forecastUrl.searchParams.set('longitude', String(place.longitude))
  forecastUrl.searchParams.set('current', 'temperature_2m,weather_code')
  forecastUrl.searchParams.set('timezone', 'auto')

  const forecastResponse = await fetch(forecastUrl, { cache: 'no-store' })

  if (!forecastResponse.ok) {
    return null
  }

  const forecast = (await forecastResponse.json()) as {
    current?: { temperature_2m?: number; weather_code?: number }
  }
  const temperature = forecast.current?.temperature_2m
  const code = forecast.current?.weather_code

  if (typeof temperature !== 'number' || typeof code !== 'number') {
    return null
  }

  return {
    city: place.name,
    temperature,
    label: getWeatherLabel(code),
  }
}

const makePreviewItems = async (items: MediaItem[]) => {
  const previews = await Promise.all(
    items.map(async (item) => {
      if (item.source === 'remote' && item.url) {
        return { ...item, previewUrl: item.url }
      }

      const blob = await getMediaBlob(item.id)
      return blob ? { ...item, previewUrl: URL.createObjectURL(blob) } : null
    }),
  )

  return previews.filter(Boolean) as MediaItemWithPreview[]
}

function usePublisherData() {
  const [items, setItems] = useState<MediaItemWithPreview[]>([])
  const [settings, setSettings] = useState<PublisherSettings>(() => loadSettings())
  const objectUrls = useRef<string[]>([])

  const refresh = useCallback(async () => {
    const storedItems = await getAllMedia()
    const nextItems = await makePreviewItems(storedItems)

    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.current = nextItems
      .filter((item) => item.source === 'local')
      .map((item) => item.previewUrl)

    setItems(nextItems)
    setSettings(loadSettings())
  }, [])

  useEffect(() => {
    // IndexedDB is browser-only, so persisted media is loaded after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()

    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [refresh])

  const updateSettings = (nextSettings: PublisherSettings) => {
    setSettings(nextSettings)
    saveSettings(nextSettings)
  }

  return { items, settings, refresh, updateSettings, setItems }
}

function AdminView() {
  const { items, settings, refresh, updateSettings, setItems } = usePublisherData()
  const [remoteUrl, setRemoteUrl] = useState('')
  const [remoteKind, setRemoteKind] = useState<'image' | 'video'>('image')
  const [playlistUrl, setPlaylistUrl] = useState(() => loadRemotePlaylistUrl())
  const [displayBaseUrl, setDisplayBaseUrl] = useState(() => loadDisplayBaseUrl())
  const [kioskMode, setKioskMode] = useState(() => loadKioskMode())
  const [statusMessage, setStatusMessage] = useState('')
  const [cloudMessage, setCloudMessage] = useState('')
  const [linkMessage, setLinkMessage] = useState('')
  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [cloudUserEmail, setCloudUserEmail] = useState('')
  const [hoverPreviewItem, setHoverPreviewItem] = useState<MediaItemWithPreview | null>(null)
  const [modalPreviewItem, setModalPreviewItem] = useState<MediaItemWithPreview | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfQuality, setPdfQuality] = useState<PdfConvertQuality>(300)
  const [pdfProgress, setPdfProgress] = useState('')
  const [isConvertingPdf, setIsConvertingPdf] = useState(false)
  const [shortDisplayUrl, setShortDisplayUrl] = useState('')
  const [isShorteningUrl, setIsShorteningUrl] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() => loadOrganizationId())
  const [newOrganizationName, setNewOrganizationName] = useState('')
  const [organizationMessage, setOrganizationMessage] = useState('')
  const cloudReady = isCloudStorageConfigured()
  const cloudAuthenticated = Boolean(cloudUserEmail)

  useEffect(() => {
    if (!cloudReady) {
      return
    }

    void getCloudUser().then((user) => setCloudUserEmail(user?.email ?? ''))
  }, [cloudReady])

  const refreshOrganizations = useCallback(async () => {
    if (!cloudReady || !cloudAuthenticated) {
      setOrganizations([])
      return
    }

    try {
      const nextOrganizations = await listOrganizations()
      setOrganizations(nextOrganizations)

      if (!selectedOrganizationId && nextOrganizations[0]) {
        setSelectedOrganizationId(nextOrganizations[0].id)
        saveOrganizationId(nextOrganizations[0].id)
      }
    } catch (error) {
      setOrganizationMessage(error instanceof Error ? error.message : 'No se pudieron cargar las organizaciones.')
    }
  }, [cloudAuthenticated, cloudReady, selectedOrganizationId])

  useEffect(() => {
    // Supabase data is loaded after the auth state is known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshOrganizations()
  }, [refreshOrganizations])

  useEffect(() => {
    if (!modalPreviewItem) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalPreviewItem(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalPreviewItem])

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return
    }

    await addFiles(Array.from(files).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/')))
    await refresh()
  }

  const handleCloudFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return
    }

    if (!cloudReady || !cloudAuthenticated) {
      setCloudMessage('Inicia sesion en Supabase para publicar en la nube.')
      return
    }

    try {
      const uploaded = await uploadFilesToCloud(
        Array.from(files).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/')),
        selectedOrganizationId || undefined,
      )

      for (const item of uploaded) {
        await addRemoteMedia(item.url, item.name, item.kind, {
          mimeType: item.mimeType,
          size: item.size,
        })
      }

      await refresh()
      setCloudMessage(`Publicados ${uploaded.length} archivos en Supabase.`)
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : 'No se pudo publicar en la nube.')
    }
  }

  const changeOrganization = (organizationId: string) => {
    setSelectedOrganizationId(organizationId)
    saveOrganizationId(organizationId)
    setShortDisplayUrl('')
  }

  const addOrganization = async () => {
    if (!cloudReady || !cloudAuthenticated) {
      setOrganizationMessage('Inicia sesion para crear una organizacion.')
      return
    }

    try {
      const organization = await createOrganization(newOrganizationName)
      const nextOrganizations = [...organizations, organization].sort((a, b) => a.name.localeCompare(b.name))
      setOrganizations(nextOrganizations)
      setNewOrganizationName('')
      changeOrganization(organization.id)
      setOrganizationMessage(`Organizacion creada: ${organization.name}.`)
    } catch (error) {
      setOrganizationMessage(error instanceof Error ? error.message : 'No se pudo crear la organizacion.')
    }
  }

  const convertPdf = async () => {
    if (!pdfFile || isConvertingPdf) {
      return
    }

    try {
      setIsConvertingPdf(true)
      setPdfProgress('Preparando PDF...')
      let addedPages = 0

      await convertPdfToPngFiles(
        pdfFile,
        pdfQuality,
        ({ page, total }) => {
          setPdfProgress(`Pagina ${page} de ${total} lista.`)
        },
        async (file, { page, total }) => {
          if (cloudReady && cloudAuthenticated) {
            setPdfProgress(`Subiendo pagina ${page} de ${total} a Supabase...`)
            const uploaded = await uploadMediaToCloud({
              name: file.name,
              kind: 'image',
              blob: file,
              mimeType: file.type,
              size: file.size,
            }, selectedOrganizationId || undefined)

            await addRemoteMedia(uploaded.url, uploaded.name, uploaded.kind, {
              mimeType: uploaded.mimeType,
              size: uploaded.size,
            })
          } else {
            await addFiles([file])
          }

          addedPages = page
          setPdfProgress(`Guardada pagina ${page} de ${total}.`)
        },
      )
      await refresh()
      setPdfProgress(
        cloudReady && cloudAuthenticated
          ? `PDF convertido y subido: ${addedPages} imagenes PNG agregadas. Toca Publicar para actualizar las pantallas.`
          : `PDF convertido: ${addedPages} imagenes PNG locales agregadas. Inicia sesion y toca Publicar para enviarlas.`,
      )
    } catch (error) {
      setPdfProgress(error instanceof Error ? error.message : 'No se pudo convertir el PDF.')
    } finally {
      setIsConvertingPdf(false)
    }
  }

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextItems = [...items]
    const target = index + direction

    if (target < 0 || target >= nextItems.length) {
      return
    }

    const [item] = nextItems.splice(index, 1)
    nextItems.splice(target, 0, item)
    setItems(nextItems)
    saveOrder(nextItems.map((nextItem) => nextItem.id))
  }

  const removeItem = async (id: string) => {
    await deleteMedia(id)
    await refresh()
  }

  const clearItems = async () => {
    await deleteAllMedia()
    await refresh()
    setStatusMessage('Lista local limpiada. Toca Publicar para actualizar las pantallas.')
  }

  const updateItemDuration = async (item: MediaItemWithPreview, value: string) => {
    const durationSeconds = Number(value)

    await updateMediaItem({
      ...item,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : undefined,
    })
    await refresh()
  }

  const addRemote = async () => {
    const url = remoteUrl.trim()

    if (!url) {
      return
    }

    const name = url.split('/').pop()?.split('?')[0] || 'Contenido remoto'
    await addRemoteMedia(url, name, remoteKind)
    setRemoteUrl('')
    await refresh()
  }

  const importPlaylistFile = async (files: FileList | null) => {
    const file = files?.[0]

    if (!file) {
      return
    }

    try {
      const playlist = parseRemotePlaylist(JSON.parse(await file.text()))
      await replaceWithRemotePlaylist(playlist)
      await refresh()
      setStatusMessage(`Playlist importada: ${playlist.items.length} contenidos.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo importar la playlist.')
    }
  }

  const exportPlaylist = async () => {
    const playlist = await exportRemotePlaylist()
    const blob = new Blob([JSON.stringify(playlist, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'neutralpublisher-playlist.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setStatusMessage(`Exportados ${playlist.items.length} contenidos remotos.`)
  }

  const publishPlaylist = async () => {
    if (!cloudReady || !cloudAuthenticated) {
      setStatusMessage('Inicia sesion en Supabase para publicar la playlist.')
      return
    }

    try {
      const localItems = items.filter((item) => item.source === 'local')

      if (localItems.length) {
        setStatusMessage(`Subiendo ${localItems.length} archivos locales a Supabase...`)

        for (const item of localItems) {
          const blob = await getMediaBlob(item.id)

          if (!blob) {
            throw new Error(`No se encontro el archivo local ${item.name}.`)
          }

          const uploaded = await uploadMediaToCloud({
            name: item.name,
            kind: item.kind,
            blob,
            mimeType: item.mimeType,
            size: item.size,
          }, selectedOrganizationId || undefined)

          await updateMediaItem({
            id: item.id,
            name: item.name,
            kind: item.kind,
            source: 'remote',
            url: uploaded.url,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
            durationSeconds: item.durationSeconds,
            createdAt: item.createdAt,
          })
        }

        await refresh()
      }

      const playlist = await exportRemotePlaylist()

      if (!playlist.items.length) {
        setStatusMessage('No hay contenido remoto para publicar. Carga imagenes o videos y vuelve a publicar.')
        return
      }

      await publishJsonToCloud('neutralpublisher-playlist', playlist)
      const channelUrl = await publishChannelPlaylistToCloud(playlist, 'principal', selectedOrganizationId || undefined)

      setPlaylistUrl(channelUrl)
      saveRemotePlaylistUrl(channelUrl)
      setStatusMessage(`Playlist publicada: ${playlist.items.length} contenidos remotos. El visor corto ya esta actualizado.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo publicar la playlist.')
    }
  }

  const syncPlaylistUrl = async () => {
    const url = playlistUrl.trim()

    saveRemotePlaylistUrl(url)

    if (!url) {
      setStatusMessage('Playlist remota desactivada.')
      return
    }

    try {
      const playlist = await fetchRemotePlaylist(url)
      await replaceWithRemotePlaylist(playlist)
      await refresh()
      setStatusMessage(`Sincronizado: ${playlist.items.length} contenidos.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo sincronizar la playlist remota.')
    }
  }

  const loadDemoPlaylist = async () => {
    const url = getSamplePlaylistUrl(displayBaseUrl)

    try {
      const playlist = await fetchRemotePlaylist(url)

      setPlaylistUrl(url)
      saveRemotePlaylistUrl(url)
      await replaceWithRemotePlaylist(playlist)
      await refresh()
      setStatusMessage(`Demo cargada: ${playlist.items.length} contenidos.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo cargar la demo.')
    }
  }

  const displayUrl = buildDisplayUrl('', displayBaseUrl, kioskMode, selectedOrganizationId)
  const tvUrl = shortDisplayUrl || displayUrl

  const updateDisplayBaseUrl = (value: string) => {
    setShortDisplayUrl('')
    setDisplayBaseUrl(value)
    saveDisplayBaseUrl(value)
  }

  const updateKioskMode = (enabled: boolean) => {
    setShortDisplayUrl('')
    setKioskMode(enabled)
    saveKioskMode(enabled)
  }

  const copyDisplayUrl = async () => {
    try {
      await navigator.clipboard.writeText(tvUrl)
      setLinkMessage('Enlace copiado.')
    } catch {
      setLinkMessage('No se pudo copiar el enlace.')
    }
  }

  const shortenDisplayUrl = async () => {
    if (displayUrl.includes('127.0.0.1') || displayUrl.includes('localhost')) {
      setLinkMessage('Para acortar usa primero el enlace publico, no localhost.')
      return
    }

    try {
      setIsShorteningUrl(true)
      setLinkMessage('Generando enlace corto...')
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(displayUrl)}`)
      const text = (await response.text()).trim()

      if (!response.ok || !/^https?:\/\//.test(text)) {
        throw new Error('No se pudo generar el enlace corto.')
      }

      setShortDisplayUrl(text)
      setLinkMessage('Enlace corto listo.')
    } catch (error) {
      setLinkMessage(error instanceof Error ? error.message : 'No se pudo generar el enlace corto.')
    } finally {
      setIsShorteningUrl(false)
    }
  }

  const signInCloud = async () => {
    try {
      await signInCloudUser(cloudEmail, cloudPassword)
      const user = await getCloudUser()
      setCloudUserEmail(user?.email ?? '')
      setCloudPassword('')
      setCloudMessage('Sesion iniciada.')
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesion.')
    }
  }

  const signOutCloud = async () => {
    try {
      await signOutCloudUser()
      setCloudUserEmail('')
      setCloudMessage('Sesion cerrada.')
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : 'No se pudo cerrar sesion.')
    }
  }

  return (
    <main className="admin-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">NeutralPublisher</p>
          <h1>Administrador de pantalla</h1>
        </div>
        <nav className="top-actions" aria-label="Acciones principales">
          <a className="icon-button labeled" href={displayUrl} title="Abrir visor">
            <MonitorPlay size={18} />
            <span>Visor</span>
          </a>
          <button className="icon-button labeled" type="button" onClick={() => void refresh()} title="Actualizar">
            <RefreshCw size={18} />
            <span>Actualizar</span>
          </button>
        </nav>
      </header>

      <section className="panel organization-panel">
        <div className="panel-heading">
          <Building2 size={20} />
          <h2>Organizacion</h2>
        </div>

        <div className="organization-grid">
          <label className="field organization-field">
            <span>Empresa activa</span>
            <select
              value={selectedOrganizationId}
              disabled={!cloudReady || !cloudAuthenticated}
              onChange={(event) => changeOrganization(event.target.value)}
            >
              <option value="">Canal principal sin empresa</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field organization-field">
            <span>Nueva empresa</span>
            <input
              disabled={!cloudReady || !cloudAuthenticated}
              placeholder="Ej: Farmacia Centro"
              value={newOrganizationName}
              onChange={(event) => setNewOrganizationName(event.target.value)}
            />
          </label>

          <button
            className="icon-button labeled organization-create"
            type="button"
            disabled={!cloudReady || !cloudAuthenticated || !newOrganizationName.trim()}
            onClick={() => void addOrganization()}
          >
            <Plus size={18} />
            <span>Crear</span>
          </button>
        </div>

        {organizationMessage ? <p className="status-message">{organizationMessage}</p> : null}
      </section>

      <section className="admin-grid">
        <div className="panel upload-panel">
          <div className="panel-heading">
            <ImagePlus size={20} />
            <h2>Contenido</h2>
          </div>

          <label className="dropzone">
            <Upload size={28} />
            <strong>Cargar imagenes o videos</strong>
            <span>Seleccion multiple, recomendado 3840x2160 para TVs 4K.</span>
            <input
              multiple
              type="file"
              accept="image/*,video/mp4,video/webm"
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </label>

          <div className="remote-row">
            <select value={remoteKind} onChange={(event) => setRemoteKind(event.target.value as 'image' | 'video')}>
              <option value="image">Imagen URL</option>
              <option value="video">Video URL</option>
            </select>
            <input
              value={remoteUrl}
              placeholder="https://cdn.ejemplo.com/publicidad.mp4"
              onChange={(event) => setRemoteUrl(event.target.value)}
            />
            <button className="icon-button" type="button" onClick={() => void addRemote()} title="Agregar URL">
              <Plus size={18} />
            </button>
          </div>

          {cloudReady ? (
            <div className="cloud-auth">
              {cloudAuthenticated ? (
                <>
                  <span>{cloudUserEmail}</span>
                  <button className="icon-button labeled" type="button" onClick={() => void signOutCloud()}>
                    <span>Salir</span>
                  </button>
                </>
              ) : (
                <>
                  <input
                    autoComplete="email"
                    placeholder="email"
                    type="email"
                    value={cloudEmail}
                    onChange={(event) => setCloudEmail(event.target.value)}
                  />
                  <input
                    autoComplete="current-password"
                    placeholder="password"
                    type="password"
                    value={cloudPassword}
                    onChange={(event) => setCloudPassword(event.target.value)}
                  />
                  <button className="icon-button labeled" type="button" onClick={() => void signInCloud()}>
                    <span>Entrar</span>
                  </button>
                </>
              )}
            </div>
          ) : null}

          <label className={`cloud-dropzone ${cloudReady && cloudAuthenticated ? '' : 'disabled'}`}>
            <CloudUpload size={22} />
            <span>
              {cloudReady
                ? cloudAuthenticated
                  ? 'Publicar archivos en Supabase'
                  : 'Supabase requiere sesion'
                : 'Supabase no configurado'}
            </span>
            <input
              multiple
              type="file"
              accept="image/*,video/mp4,video/webm"
              disabled={!cloudReady || !cloudAuthenticated}
              onChange={(event) => void handleCloudFiles(event.target.files)}
            />
          </label>
          {cloudMessage ? <p className="status-message">{cloudMessage}</p> : null}
        </div>

        <div className="panel settings-panel">
          <div className="panel-heading">
            <Settings size={20} />
            <h2>Ajustes</h2>
          </div>

          <label className="field">
            <span>Duracion por imagen</span>
            <input
              min="3"
              max="120"
              type="number"
              value={settings.slideSeconds}
              onChange={(event) =>
                updateSettings({ ...settings, slideSeconds: Number(event.target.value) || settings.slideSeconds })
              }
            />
          </label>

          <label className="field">
            <span>Transicion</span>
            <select
              value={settings.transition}
              onChange={(event) => updateSettings({ ...settings, transition: event.target.value as TransitionName })}
            >
              {transitions.map((transition) => (
                <option key={transition.value} value={transition.value}>
                  {transition.label}
                </option>
              ))}
            </select>
          </label>

          <div className="segmented" aria-label="Ajuste de imagen">
            <button
              className={settings.fitMode === 'cover' ? 'active' : ''}
              type="button"
              onClick={() => updateSettings({ ...settings, fitMode: 'cover' })}
            >
              Cubrir
            </button>
            <button
              className={settings.fitMode === 'contain' ? 'active' : ''}
              type="button"
              onClick={() => updateSettings({ ...settings, fitMode: 'contain' })}
            >
              Contener
            </button>
          </div>

          <label className="check">
            <input
              checked={settings.showClock}
              type="checkbox"
              onChange={(event) => updateSettings({ ...settings, showClock: event.target.checked })}
            />
            <span>Mostrar hora</span>
          </label>
          <label className="check">
            <input
              checked={settings.showWeather}
              type="checkbox"
              onChange={(event) => updateSettings({ ...settings, showWeather: event.target.checked })}
            />
            <span>Mostrar clima</span>
          </label>
          {settings.showWeather ? (
            <label className="field compact-field">
              <span>Ciudad del clima</span>
              <input
                placeholder="Mendoza"
                value={settings.weatherCity}
                onChange={(event) => updateSettings({ ...settings, weatherCity: event.target.value })}
              />
            </label>
          ) : null}
          <label className="check">
            <input
              checked={settings.videoMuted}
              type="checkbox"
              onChange={(event) => updateSettings({ ...settings, videoMuted: event.target.checked })}
            />
            <span>Videos sin sonido</span>
          </label>
          <label className="check">
            <input
              checked={settings.showBadge}
              type="checkbox"
              onChange={(event) => updateSettings({ ...settings, showBadge: event.target.checked })}
            />
            <span>Marca discreta</span>
          </label>
        </div>
      </section>

      <section className="panel pdf-panel">
        <div className="panel-heading">
          <FileImage size={20} />
          <h2>PDF a PNG</h2>
        </div>

        <div className="pdf-grid">
          <label className="pdf-file-button">
            <FileUp size={18} />
            <span>{pdfFile ? pdfFile.name : 'Cargar PDF'}</span>
            <input accept="application/pdf,.pdf" type="file" onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)} />
          </label>

          <div className="segmented pdf-quality" aria-label="Calidad de PDF">
            <button className={pdfQuality === 300 ? 'active' : ''} type="button" onClick={() => setPdfQuality(300)}>
              300 DPI
            </button>
            <button className={pdfQuality === 600 ? 'active' : ''} type="button" onClick={() => setPdfQuality(600)}>
              600 DPI
            </button>
          </div>

          <button
            className="icon-button labeled pdf-convert-button"
            type="button"
            disabled={!pdfFile || isConvertingPdf}
            onClick={() => void convertPdf()}
          >
            <Download size={18} />
            <span>{isConvertingPdf ? 'Convirtiendo' : 'Convertir a PNG'}</span>
          </button>
        </div>

        <p className="pdf-help">
          300 DPI es recomendado para web y TV. 600 DPI genera mas detalle, pero tarda mas y crea archivos grandes.
        </p>
        {pdfProgress ? <p className="status-message">{pdfProgress}</p> : null}
      </section>

      <section className="panel sync-panel">
        <div className="panel-heading">
          <Link size={20} />
          <h2>Playlist remota</h2>
        </div>

        <div className="sync-grid">
          <input
            value={playlistUrl}
            placeholder="https://cdn.ejemplo.com/neutralpublisher-playlist.json"
            onChange={(event) => setPlaylistUrl(event.target.value)}
          />
          <button className="icon-button labeled" type="button" onClick={() => void syncPlaylistUrl()} title="Sincronizar JSON">
            <RefreshCw size={18} />
            <span>Sincronizar</span>
          </button>
          <button className="icon-button labeled" type="button" onClick={() => void loadDemoPlaylist()} title="Cargar demo">
            <Sparkles size={18} />
            <span>Demo</span>
          </button>
          <label className="icon-button labeled import-button" title="Importar JSON">
            <FileUp size={18} />
            <span>Importar</span>
            <input accept="application/json,.json" type="file" onChange={(event) => void importPlaylistFile(event.target.files)} />
          </label>
          <button className="icon-button labeled" type="button" onClick={() => void exportPlaylist()} title="Exportar JSON">
            <Download size={18} />
            <span>Exportar</span>
          </button>
          <button
            className="icon-button labeled"
            type="button"
            disabled={!cloudReady || !cloudAuthenticated}
            onClick={() => void publishPlaylist()}
            title="Publicar JSON en Supabase"
          >
            <CloudUpload size={18} />
            <span>Publicar</span>
          </button>
        </div>

        {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
      </section>

      <section className="panel tv-link-panel">
        <div className="panel-heading">
          <QrCode size={20} />
          <h2>Enlace para TV</h2>
        </div>

        <div className="tv-link-grid">
          <div className="qr-box" aria-label="QR del visor">
            <QRCodeSVG value={tvUrl} size={132} marginSize={1} />
          </div>
          <div className="tv-link-copy">
            <label className="field tv-base-field">
              <span>URL base para TV</span>
              <input
                value={displayBaseUrl}
                placeholder="http://192.168.1.13:5174"
                onChange={(event) => updateDisplayBaseUrl(event.target.value)}
              />
            </label>
            <input readOnly value={tvUrl} aria-label="URL del visor" />
            {displayUrl.includes('127.0.0.1') || displayUrl.includes('localhost') ? (
              <p className="warning-message">Para celular o TV usa la IP de la PC, no 127.0.0.1.</p>
            ) : null}
            <label className="check kiosk-check">
              <input checked={kioskMode} type="checkbox" onChange={(event) => updateKioskMode(event.target.checked)} />
              <span>Modo kiosk</span>
            </label>
            <div className="tv-link-actions">
              <button className="icon-button labeled" type="button" onClick={() => void copyDisplayUrl()} title="Copiar enlace">
                <Copy size={18} />
                <span>Copiar</span>
              </button>
              <button
                className="icon-button labeled"
                type="button"
                disabled={isShorteningUrl}
                onClick={() => void shortenDisplayUrl()}
                title="Crear enlace corto"
              >
                <Link size={18} />
                <span>{shortDisplayUrl ? 'Acortado' : 'Acortar'}</span>
              </button>
              <a className="icon-button labeled" href={tvUrl} target="_blank" rel="noreferrer" title="Abrir visor">
                <ExternalLink size={18} />
                <span>Abrir</span>
              </a>
            </div>
            {linkMessage ? <p className="status-message">{linkMessage}</p> : null}
          </div>
        </div>
      </section>

      <section className="library">
        <div className="library-heading">
          <div>
            <h2>Lista de reproduccion</h2>
            <p>{items.length ? `${items.length} elementos listos` : 'Todavia no hay contenido cargado'}</p>
          </div>
          <div className="library-actions">
            <button className="display-link danger-link" type="button" disabled={!items.length} onClick={() => void clearItems()}>
              <Trash2 size={16} />
              <span>Limpiar lista</span>
            </button>
            <a className="display-link" href={displayUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              <span>Abrir en otra pantalla</span>
            </a>
          </div>
        </div>

        <div className="media-list">
          {items.map((item, index) => (
            <article className="media-card" key={item.id}>
              <button
                className="thumb"
                type="button"
                onBlur={() => setHoverPreviewItem(null)}
                onClick={() => setModalPreviewItem(item)}
                onFocus={() => setHoverPreviewItem(item)}
                onMouseEnter={() => setHoverPreviewItem(item)}
                onMouseLeave={() => setHoverPreviewItem(null)}
                title="Previsualizar"
              >
                {item.kind === 'video' ? (
                  <video src={item.previewUrl} muted playsInline />
                ) : (
                  <img src={item.previewUrl} alt="" decoding="async" loading="lazy" />
                )}
                <span>{item.kind === 'video' ? 'Video' : 'Imagen'}</span>
              </button>
              <div className="media-meta">
                <strong>{item.name}</strong>
                <small>
                  {item.source === 'remote' ? 'Remoto' : 'Local'} - {formatBytes(item.size)}
                </small>
                <label className="duration-field">
                  <span>Segundos</span>
                  <input
                    min="1"
                    max="3600"
                    placeholder={`${settings.slideSeconds}`}
                    type="number"
                    value={item.durationSeconds ?? ''}
                    onChange={(event) => void updateItemDuration(item, event.target.value)}
                  />
                </label>
              </div>
              <div className="row-actions">
                <button className="icon-button" type="button" onClick={() => moveItem(index, -1)} title="Subir">
                  <ArrowUp size={17} />
                </button>
                <button className="icon-button" type="button" onClick={() => moveItem(index, 1)} title="Bajar">
                  <ArrowDown size={17} />
                </button>
                <button className="icon-button danger" type="button" onClick={() => void removeItem(item.id)} title="Quitar">
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {hoverPreviewItem ? (
        <div className="preview-popover hover-preview" aria-label="Previsualizacion rapida">
          <div className="preview-frame">
            <div className="preview-media">
              {hoverPreviewItem.kind === 'video' ? (
                <video src={hoverPreviewItem.previewUrl} muted playsInline />
              ) : (
                <img src={hoverPreviewItem.previewUrl} alt="" decoding="async" />
              )}
            </div>
            <div className="preview-meta">
              <div>
                <strong>{hoverPreviewItem.name}</strong>
                <span>
                  {hoverPreviewItem.kind === 'video' ? 'Video' : 'Imagen'} -{' '}
                  {hoverPreviewItem.source === 'remote' ? 'Remoto' : 'Local'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modalPreviewItem ? (
        <div className="preview-popover" role="dialog" aria-label="Previsualizacion de contenido">
          <button className="preview-backdrop" type="button" onClick={() => setModalPreviewItem(null)} aria-label="Cerrar" />
          <div className="preview-frame">
            <div className="preview-media">
              {modalPreviewItem.kind === 'video' ? (
                <video src={modalPreviewItem.previewUrl} muted playsInline controls />
              ) : (
                <img src={modalPreviewItem.previewUrl} alt="" decoding="async" />
              )}
            </div>
            <div className="preview-meta">
              <div>
                <strong>{modalPreviewItem.name}</strong>
                <span>
                  {modalPreviewItem.kind === 'video' ? 'Video' : 'Imagen'} -{' '}
                  {modalPreviewItem.source === 'remote' ? 'Remoto' : 'Local'}
                </span>
              </div>
              <button className="icon-button" type="button" onClick={() => setModalPreviewItem(null)} title="Cerrar">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function DisplayView() {
  const { items, settings, refresh } = usePublisherData()
  const [activeIndex, setActiveIndex] = useState(0)
  const [clock, setClock] = useState(() => new Date())
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [playbackMessage, setPlaybackMessage] = useState('')
  const kioskMode = getHashKioskMode()
  const organizationId = getHashOrganizationId()

  const safeActiveIndex = items.length ? activeIndex % items.length : 0
  const activeItem = items[safeActiveIndex]
  const nextItem = items[(safeActiveIndex + 1) % items.length]
  const activeDuration = activeItem?.durationSeconds || settings.slideSeconds

  const goToNextItem = useCallback(() => {
    if (items.length <= 1) {
      return
    }

    setPlaybackMessage('')
    setActiveIndex((index) => (index + 1) % items.length)
  }, [items.length])

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!settings.showWeather) {
      return
    }

    let cancelled = false

    const syncWeather = async () => {
      try {
        const snapshot = await fetchWeather(settings.weatherCity)

        if (!cancelled) {
          setWeather(snapshot)
        }
      } catch {
        if (!cancelled) {
          setWeather(null)
        }
      }
    }

    void syncWeather()
    const interval = window.setInterval(() => void syncWeather(), 30 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [settings.showWeather, settings.weatherCity])

  useEffect(() => {
    if (!items.length || activeItem?.kind === 'video') {
      return
    }

    const timer = window.setTimeout(() => {
      goToNextItem()
    }, activeDuration * 1000)

    return () => window.clearTimeout(timer)
  }, [activeDuration, activeItem?.kind, activeIndex, goToNextItem, items.length])

  useEffect(() => {
    const sync = async () => {
      const url = getHashPlaylistUrl() || (organizationId ? '' : loadRemotePlaylistUrl())
      const defaultUrl = getDefaultDisplayPlaylistUrl(organizationId || undefined)
      const syncUrl = url || defaultUrl

      if (syncUrl) {
        try {
          const playlist = await fetchRemotePlaylist(syncUrl)
          await replaceWithRemotePlaylist(playlist)
        } catch {
          // The player keeps showing the last cached playlist when sync fails.
        }
      }

      await refresh()
      setPlaybackMessage('')
    }

    void sync()

    const interval = window.setInterval(() => void sync(), 60_000)
    return () => window.clearInterval(interval)
  }, [organizationId, refresh])

  const formattedClock = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }).format(clock),
    [clock],
  )
  const formattedWidgetDate = useMemo(
    () =>
      new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(clock),
    [clock],
  )

  const requestFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.()
    }
  }

  const handleMediaError = () => {
    setPlaybackMessage('Contenido no disponible. Saltando...')

    window.setTimeout(() => {
      goToNextItem()
    }, 1200)
  }

  if (!items.length) {
    return (
      <main className="display-shell empty-display">
        <div>
          <MonitorPlay size={44} />
          <h1>NeutralPublisher</h1>
          <p>Carga contenido desde el administrador para iniciar el visor.</p>
          <a href="#/admin">Abrir admin</a>
        </div>
      </main>
    )
  }

  return (
    <main className={`display-shell transition-${settings.transition}`}>
      <section className="stage" data-fit={settings.fitMode}>
        {activeItem.kind === 'video' ? (
          <video
            key={activeItem.id}
            autoPlay
            loop={items.length === 1}
            muted={settings.videoMuted}
            onError={handleMediaError}
            playsInline
            preload="auto"
            src={activeItem.previewUrl}
            onEnded={goToNextItem}
          />
        ) : (
          <img key={activeItem.id} src={activeItem.previewUrl} alt="" onError={handleMediaError} />
        )}
      </section>

      {nextItem ? (
        <div className="media-preloader" aria-hidden="true">
          {nextItem.kind === 'video' ? (
            <video muted preload="auto" src={nextItem.previewUrl} />
          ) : (
            <img src={nextItem.previewUrl} alt="" />
          )}
        </div>
      ) : null}

      {settings.showWeather ? (
        <aside className="weather-clock" aria-label="Clima y hora">
          <div className="weather-row">
            <CloudSun className="weather-icon" aria-hidden="true" />
            <div className="weather-temp">
              {weather ? `${Math.round(weather.temperature)}°` : '--°'}
            </div>
          </div>
          <div className="weather-meta">
            <span>{weather?.city || settings.weatherCity || 'Clima'}</span>
            <span>{weather?.label || 'Actualizando'}</span>
          </div>
          {settings.showClock ? <div className="weather-date">{formattedWidgetDate}</div> : null}
        </aside>
      ) : settings.showClock ? (
        <div className="clock">{formattedClock}</div>
      ) : null}
      {settings.showBadge ? <div className="brand-badge">NeutralPublisher</div> : null}
      {playbackMessage ? <div className="playback-message">{playbackMessage}</div> : null}

      {kioskMode ? null : (
        <>
          <button className="fullscreen-peek" type="button" onClick={requestFullscreen} title="Pantalla completa">
            <Maximize size={18} />
          </button>
          <a className="admin-peek" href="#/admin" title="Administrar">
            <Eye size={18} />
          </a>
        </>
      )}
    </main>
  )
}

function HomeView() {
  const displayBaseUrl = loadDisplayBaseUrl()
  const kioskMode = loadKioskMode()
  const displayUrl = buildDisplayUrl('', displayBaseUrl, kioskMode)

  return (
    <main className="home-shell">
      <section className="home-panel">
        <p className="eyebrow">NeutralPublisher</p>
        <h1>Centro de pantalla</h1>
        <div className="home-actions">
          <a className="home-action" href="#/admin">
            <Settings size={24} />
            <span>Administrar</span>
          </a>
          <a className="home-action" href={displayUrl}>
            <MonitorPlay size={24} />
            <span>Ver pantalla</span>
          </a>
          <a className="home-action" href="#/display?kiosk=1">
            <Home size={24} />
            <span>Kiosk local</span>
          </a>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [route, setRoute] = useState(() => getHashRoute())

  useEffect(() => {
    const handleHashChange = () => setRoute(getHashRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (route === '/display') {
    return <DisplayView />
  }

  if (route === '/admin') {
    return <AdminView />
  }

  return <HomeView />
}

export default App
