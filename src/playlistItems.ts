import { createId } from './id'
import type { MediaItem, RemotePlaylistItem } from './types'

const identity = (item: Pick<MediaItem, 'kind' | 'url'>) => `${item.kind}\n${item.url}`

export function reconcilePlaylistItems(previous: MediaItem[], incoming: RemotePlaylistItem[]): MediaItem[] {
  const available = new Map<string, MediaItem[]>()

  for (const item of previous) {
    if (item.source !== 'remote' || !item.url) continue
    const key = identity(item)
    available.set(key, [...(available.get(key) ?? []), item])
  }

  return incoming.map((item) => {
    const existing = available.get(identity(item))?.shift()
    return {
      id: existing?.id ?? createId(),
      name: item.name,
      kind: item.kind,
      source: 'remote',
      url: item.url,
      mimeType: item.mimeType || (item.kind === 'video' ? 'video/mp4' : 'image/*'),
      size: 0,
      durationSeconds: item.durationSeconds,
      createdAt: existing?.createdAt ?? Date.now(),
    }
  })
}

export function samePlaylistItems(previous: MediaItem[], next: MediaItem[]): boolean {
  return previous.length === next.length && previous.every((item, index) => {
    const replacement = next[index]
    return item.id === replacement.id && item.name === replacement.name && item.kind === replacement.kind &&
      item.source === replacement.source && item.url === replacement.url && item.mimeType === replacement.mimeType &&
      item.durationSeconds === replacement.durationSeconds
  })
}
