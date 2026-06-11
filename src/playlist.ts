import { defaultSettings, type MediaKind, type RemotePlaylist, type TransitionName } from './types'

const transitions: TransitionName[] = ['fade', 'slide-x', 'slide-y', 'zoom', 'flip', 'blur']
const mediaKinds: MediaKind[] = ['image', 'video']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toPositiveNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback

const toString = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim() : fallback)

export const parseRemotePlaylist = (value: unknown): RemotePlaylist => {
  if (!isRecord(value)) {
    throw new Error('El archivo no tiene formato de playlist.')
  }

  if (!Array.isArray(value.items)) {
    throw new Error('La playlist no tiene una lista de contenidos.')
  }

  const rawSettings = isRecord(value.settings) ? value.settings : {}
  const transition = transitions.includes(rawSettings.transition as TransitionName)
    ? (rawSettings.transition as TransitionName)
    : defaultSettings.transition
  const fitMode = rawSettings.fitMode === 'contain' ? 'contain' : defaultSettings.fitMode

  const items = value.items.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`El item ${index + 1} no es valido.`)
    }

    const kind = mediaKinds.includes(item.kind as MediaKind) ? (item.kind as MediaKind) : undefined
    const url = toString(item.url, '')

    if (!kind || !url) {
      throw new Error(`El item ${index + 1} necesita kind y url.`)
    }

    return {
      name: toString(item.name, `Contenido ${index + 1}`),
      kind,
      url,
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
      durationSeconds: typeof item.durationSeconds === 'number' ? item.durationSeconds : undefined,
    }
  })

  return {
    version: 1,
    name: toString(value.name, 'NeutralPublisher Playlist'),
    settings: {
      slideSeconds: toPositiveNumber(rawSettings.slideSeconds, defaultSettings.slideSeconds),
      transition,
      fitMode,
      showClock: typeof rawSettings.showClock === 'boolean' ? rawSettings.showClock : defaultSettings.showClock,
      showBadge: typeof rawSettings.showBadge === 'boolean' ? rawSettings.showBadge : defaultSettings.showBadge,
      videoMuted: typeof rawSettings.videoMuted === 'boolean' ? rawSettings.videoMuted : defaultSettings.videoMuted,
    },
    items,
  }
}

export const fetchRemotePlaylist = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`No se pudo cargar la playlist remota (${response.status}).`)
  }

  return parseRemotePlaylist(await response.json())
}
