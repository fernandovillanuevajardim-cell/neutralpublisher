import { registerSW } from 'virtual:pwa-register'

export const registerServiceWorker = () => {
  registerSW({
    immediate: true,
    onRegisteredSW(_, registration) {
      window.setInterval(
        () => {
          void registration?.update()
        },
        60 * 60 * 1000,
      )
    },
  })
}
