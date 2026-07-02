import {
  defaultSettings,
  type MediaItem,
  type PublisherSettings,
  type RemotePlaylist,
  type RemotePlaylistItem,
} from './types'
import { createId } from './id'

const databaseName = 'neutral-publisher'
const databaseVersion = 1
const mediaStore = 'media'
const blobStore = 'blobs'
const settingsKey = 'neutral-publisher-settings'
const orderKey = 'neutral-publisher-order'
const remotePlaylistUrlKey = 'neutral-publisher-remote-playlist-url'
const displayBaseUrlKey = 'neutral-publisher-display-base-url'
const kioskModeKey = 'neutral-publisher-kiosk-mode'
const organizationIdKey = 'neutral-publisher-organization-id'

type BlobRecord = {
  id: string
  blob: Blob
}

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(mediaStore)) {
        database.createObjectStore(mediaStore, { keyPath: 'id' })
      }

      if (!database.objectStoreNames.contains(blobStore)) {
        database.createObjectStore(blobStore, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

export const saveSettings = (settings: PublisherSettings) => {
  localStorage.setItem(settingsKey, JSON.stringify(settings))
}

export const loadSettings = (): PublisherSettings => {
  const raw = localStorage.getItem(settingsKey)

  if (!raw) {
    return defaultSettings
  }

  try {
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

export const loadOrder = () => {
  const raw = localStorage.getItem(orderKey)

  if (!raw) {
    return []
  }

  try {
    const order = JSON.parse(raw)
    return Array.isArray(order) ? order : []
  } catch {
    return []
  }
}

export const saveOrder = (ids: string[]) => {
  localStorage.setItem(orderKey, JSON.stringify(ids))
}

export const loadRemotePlaylistUrl = () => localStorage.getItem(remotePlaylistUrlKey) ?? ''

export const saveRemotePlaylistUrl = (url: string) => {
  localStorage.setItem(remotePlaylistUrlKey, url.trim())
}

export const loadDisplayBaseUrl = () => localStorage.getItem(displayBaseUrlKey) ?? ''

export const saveDisplayBaseUrl = (url: string) => {
  localStorage.setItem(displayBaseUrlKey, url.trim().replace(/\/$/, ''))
}

export const loadKioskMode = () => localStorage.getItem(kioskModeKey) === 'true'

export const saveKioskMode = (enabled: boolean) => {
  localStorage.setItem(kioskModeKey, String(enabled))
}

export const loadOrganizationId = () => localStorage.getItem(organizationIdKey) ?? ''

export const saveOrganizationId = (id: string) => {
  if (!id) {
    localStorage.removeItem(organizationIdKey)
    return
  }

  localStorage.setItem(organizationIdKey, id)
}

export const getAllMedia = async (): Promise<MediaItem[]> => {
  const database = await openDatabase()
  const transaction = database.transaction(mediaStore, 'readonly')
  const items = await requestToPromise<MediaItem[]>(transaction.objectStore(mediaStore).getAll())
  database.close()

  const order = loadOrder()
  const rank = new Map(order.map((id, index) => [id, index]))

  return items.sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER

    if (aRank !== bRank) {
      return aRank - bRank
    }

    return a.createdAt - b.createdAt
  })
}

export const getMediaBlob = async (id: string): Promise<Blob | undefined> => {
  const database = await openDatabase()
  const transaction = database.transaction(blobStore, 'readonly')
  const record = await requestToPromise<BlobRecord | undefined>(transaction.objectStore(blobStore).get(id))
  database.close()

  return record?.blob
}

export const addFiles = async (files: File[]) => {
  const database = await openDatabase()
  const transaction = database.transaction([mediaStore, blobStore], 'readwrite')
  const media = transaction.objectStore(mediaStore)
  const blobs = transaction.objectStore(blobStore)
  const created: MediaItem[] = []

  for (const file of files) {
    const kind = file.type.startsWith('video/') ? 'video' : 'image'
    const id = createId()
    const item: MediaItem = {
      id,
      name: file.name,
      kind,
      source: 'local',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: Date.now(),
    }

    media.put(item)
    blobs.put({ id, blob: file })
    created.push(item)
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })

  database.close()
  saveOrder([...loadOrder(), ...created.map((item) => item.id)])

  return created
}

export const addRemoteMedia = async (
  url: string,
  name: string,
  kind: 'image' | 'video',
  options?: { mimeType?: string; size?: number; durationSeconds?: number },
) => {
  const database = await openDatabase()
  const transaction = database.transaction(mediaStore, 'readwrite')
  const item: MediaItem = {
    id: createId(),
    name,
    kind,
    source: 'remote',
    url,
    mimeType: options?.mimeType || (kind === 'video' ? 'video/mp4' : 'image/*'),
    size: options?.size ?? 0,
    durationSeconds: options?.durationSeconds,
    createdAt: Date.now(),
  }

  transaction.objectStore(mediaStore).put(item)

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })

  database.close()
  saveOrder([...loadOrder(), item.id])

  return item
}

export const updateMediaItem = async (item: MediaItem) => {
  const database = await openDatabase()
  const transaction = database.transaction(mediaStore, 'readwrite')

  transaction.objectStore(mediaStore).put(item)

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })

  database.close()
}

export const replaceWithRemotePlaylist = async (playlist: RemotePlaylist) => {
  const database = await openDatabase()
  const transaction = database.transaction([mediaStore, blobStore], 'readwrite')
  const media = transaction.objectStore(mediaStore)
  const blobs = transaction.objectStore(blobStore)
  const previousItems = await requestToPromise<MediaItem[]>(media.getAll())
  const created: MediaItem[] = []

  previousItems.forEach((item) => {
    media.delete(item.id)
    blobs.delete(item.id)
  })

  playlist.items.forEach((playlistItem) => {
    const item: MediaItem = {
      id: createId(),
      name: playlistItem.name,
      kind: playlistItem.kind,
      source: 'remote',
      url: playlistItem.url,
      mimeType: playlistItem.mimeType || (playlistItem.kind === 'video' ? 'video/mp4' : 'image/*'),
      size: 0,
      durationSeconds: playlistItem.durationSeconds,
      createdAt: Date.now(),
    }

    media.put(item)
    created.push(item)
  })

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })

  database.close()
  saveSettings(playlist.settings)
  saveOrder(created.map((item) => item.id))
}

export const exportRemotePlaylist = async (name = 'NeutralPublisher Playlist'): Promise<RemotePlaylist> => {
  const items = await getAllMedia()
  const remoteItems: RemotePlaylistItem[] = items
    .filter((item) => item.source === 'remote' && item.url)
    .map((item) => ({
      name: item.name,
      kind: item.kind,
      url: item.url as string,
      mimeType: item.mimeType,
      durationSeconds: item.durationSeconds,
    }))

  return {
    version: 1,
    name,
    settings: loadSettings(),
    items: remoteItems,
  }
}

export const deleteMedia = async (id: string) => {
  const database = await openDatabase()
  const transaction = database.transaction([mediaStore, blobStore], 'readwrite')

  transaction.objectStore(mediaStore).delete(id)
  transaction.objectStore(blobStore).delete(id)

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })

  database.close()
  saveOrder(loadOrder().filter((itemId) => itemId !== id))
}

export const deleteAllMedia = async () => {
  const database = await openDatabase()
  const transaction = database.transaction([mediaStore, blobStore], 'readwrite')

  transaction.objectStore(mediaStore).clear()
  transaction.objectStore(blobStore).clear()

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })

  database.close()
  saveOrder([])
}
