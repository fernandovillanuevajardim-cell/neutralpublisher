import { parseRemotePlaylist } from './playlist'
import type { MediaItemWithPreview, RemotePlaylist } from './types'

const cacheKey = (organizationId: string) => `neutralpublisher-display-playlist-v1:${organizationId}`

export function loadDisplayPlaylist(organizationId: string, url: string): RemotePlaylist | null {
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey(organizationId)) || 'null') as { url?: string; playlist?: unknown } | null
    return saved?.url === url ? parseRemotePlaylist(saved.playlist) : null
  } catch {
    return null
  }
}

export function saveDisplayPlaylist(organizationId: string, url: string, playlist: RemotePlaylist) {
  try {
    localStorage.setItem(cacheKey(organizationId), JSON.stringify({ url, playlist }))
  } catch {
    // Online playback still works when local storage is full or unavailable.
  }
}

export function toDisplayItems(organizationId: string, playlist: RemotePlaylist): MediaItemWithPreview[] {
  return playlist.items.map((item, index) => ({
    id: `${organizationId}:${index}:${item.url}`,
    name: item.name,
    kind: item.kind,
    source: 'remote',
    url: item.url,
    previewUrl: item.url,
    mimeType: item.mimeType || (item.kind === 'video' ? 'video/mp4' : 'image/*'),
    durationSeconds: item.durationSeconds,
    size: 0,
    createdAt: index,
  }))
}
