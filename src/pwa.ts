import { registerSW } from 'virtual:pwa-register'

const reloadOnceForStaleChunk = () => {
  const key = 'neutralpublisher-stale-chunk-reloaded'

  if (sessionStorage.getItem(key)) {
    return
  }

  sessionStorage.setItem(key, 'true')
  window.location.reload()
}

const isStaleChunkError = (message: string) =>
  message.includes('Failed to fetch dynamically imported module') ||
  message.includes('Importing a module script failed') ||
  message.includes('ChunkLoadError')

export const registerServiceWorker = () => {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true)
    },
    onOfflineReady() {
      sessionStorage.removeItem('neutralpublisher-stale-chunk-reloaded')
    },
    onRegisteredSW(_, registration) {
      window.setInterval(
        () => {
          void registration?.update()
        },
        5 * 60 * 1000,
      )
    },
  })

  window.addEventListener('error', (event) => {
    const message = event.message || String(event.error || '')

    if (isStaleChunkError(message)) {
      reloadOnceForStaleChunk()
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason || '')

    if (isStaleChunkError(message)) {
      reloadOnceForStaleChunk()
    }
  })
}
