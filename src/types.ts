export type MediaKind = 'image' | 'video'

export type MediaSource = 'local' | 'remote'

export type TransitionName =
  | 'fade'
  | 'slide-x'
  | 'slide-y'
  | 'zoom'
  | 'flip'
  | 'blur'

export type FitMode = 'cover' | 'contain'

export type MediaItem = {
  id: string
  name: string
  kind: MediaKind
  source: MediaSource
  url?: string
  mimeType: string
  size: number
  createdAt: number
  durationSeconds?: number
}

export type MediaItemWithPreview = MediaItem & {
  previewUrl: string
}

export type PublisherSettings = {
  slideSeconds: number
  transition: TransitionName
  fitMode: FitMode
  showClock: boolean
  showWeather: boolean
  weatherCity: string
  showBadge: boolean
  videoMuted: boolean
}

export const defaultSettings: PublisherSettings = {
  slideSeconds: 8,
  transition: 'fade',
  fitMode: 'cover',
  showClock: true,
  showWeather: false,
  weatherCity: 'Mendoza',
  showBadge: false,
  videoMuted: true,
}

export type RemotePlaylistItem = {
  name: string
  kind: MediaKind
  url: string
  mimeType?: string
  durationSeconds?: number
}

export type RemotePlaylist = {
  version: 1
  name: string
  settings: PublisherSettings
  items: RemotePlaylistItem[]
}
