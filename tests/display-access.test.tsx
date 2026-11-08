// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DisplayAccess, OFFLINE_GRACE_MS } from '../src/DisplayAccess'
import { clearVerified, getLastVerifiedAt, heartbeat, HEARTBEAT_MS, recordVerified } from '../src/displayControl'

vi.mock('../src/displayControl', () => ({
  HEARTBEAT_MS: 300_000,
  getDeviceIdentity: () => ({ id: '12345678-abcd', secret: 'test-only' }),
  getLastVerifiedAt: vi.fn(() => 0),
  recordVerified: vi.fn(),
  clearVerified: vi.fn(),
  heartbeat: vi.fn(),
}))

let root: Root
let container: HTMLDivElement
const mount = vi.fn()
const stop = vi.fn()
function Player() {
  useEffect(() => { mount(); return stop }, [])
  return <video data-testid="player" />
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.mocked(getLastVerifiedAt).mockReturnValue(0)
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})
async function render(org = 'company-a') {
  await act(async () => root.render(<DisplayAccess organizationId={org}><Player /></DisplayAccess>))
}

it('does not mount or download media while approval is pending', async () => {
  vi.mocked(heartbeat).mockResolvedValue('pending')
  await render()
  expect(mount).not.toHaveBeenCalled()
  expect(container.textContent).toContain('pendiente de autorizacion')
  await act(() => vi.advanceTimersByTimeAsync(HEARTBEAT_MS - 1))
  expect(heartbeat).toHaveBeenCalledTimes(1)
})

it('unmounts the entire player on disable and resumes only after authorization', async () => {
  vi.mocked(heartbeat).mockResolvedValueOnce('enabled').mockResolvedValueOnce('disabled').mockResolvedValueOnce('enabled')
  await render()
  expect(mount).toHaveBeenCalledTimes(1)
  expect(recordVerified).toHaveBeenCalledWith('company-a', { id: '12345678-abcd', secret: 'test-only' })
  await act(() => vi.advanceTimersByTimeAsync(HEARTBEAT_MS))
  expect(container.querySelector('video')).toBeNull()
  expect(stop).toHaveBeenCalledTimes(1)
  expect(container.textContent).toContain('Pantalla desactivada')
  await act(() => vi.advanceTimersByTimeAsync(HEARTBEAT_MS))
  expect(mount).toHaveBeenCalledTimes(2)
})

it('fails closed on connection error and never shows a loading message', async () => {
  vi.mocked(heartbeat).mockRejectedValue(new Error('offline'))
  await render()
  expect(mount).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Sin conexion')
  expect(container.textContent).toContain('Pantalla 12345678')
  expect(container.textContent).not.toMatch(/cargando/i)
})

it('reopens a recently authorized TV with its previous content while control retries', async () => {
  vi.mocked(getLastVerifiedAt).mockReturnValue(Date.now() - 60_000)
  vi.mocked(heartbeat).mockRejectedValue(new Error('offline'))
  await render()
  expect(mount).toHaveBeenCalledOnce()
  expect(container.querySelector('video')).not.toBeNull()
  expect(stop).not.toHaveBeenCalled()
})

it('stops showing deleted organization media even during the offline grace period', async () => {
  vi.mocked(getLastVerifiedAt).mockReturnValue(Date.now() - 60_000)
  vi.mocked(heartbeat).mockRejectedValue(new Error('Organization unavailable'))
  await render()
  expect(mount).toHaveBeenCalledOnce()
  expect(stop).toHaveBeenCalledOnce()
  expect(container.querySelector('video')).toBeNull()
  expect(clearVerified).toHaveBeenCalledWith('company-a')
  expect(container.textContent).toContain('Esta organizacion ya no existe')
})

it('does not trust an expired authorization on browser restart', async () => {
  vi.mocked(getLastVerifiedAt).mockReturnValue(Date.now() - OFFLINE_GRACE_MS - 1)
  vi.mocked(heartbeat).mockRejectedValue(new Error('offline'))
  await render()
  expect(mount).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Sin conexion')
})

it('keeps the last authorized slide through a brief control outage and retries promptly', async () => {
  vi.mocked(heartbeat).mockResolvedValueOnce('enabled').mockRejectedValueOnce(new Error('offline'))
  await render()
  await act(() => vi.advanceTimersByTimeAsync(HEARTBEAT_MS))
  expect(stop).not.toHaveBeenCalled()
  expect(container.querySelector('video')).not.toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(15_000))
  expect(heartbeat).toHaveBeenCalledTimes(3)
})

it('stops playback after the offline grace expires', async () => {
  vi.mocked(heartbeat).mockResolvedValueOnce('enabled').mockRejectedValue(new Error('offline'))
  await render()
  await act(() => vi.advanceTimersByTimeAsync(OFFLINE_GRACE_MS + HEARTBEAT_MS))
  expect(stop).toHaveBeenCalledOnce()
  expect(container.textContent).toContain('Sin conexion')
})

it('honors an explicit disable as soon as the control reconnects', async () => {
  vi.mocked(heartbeat).mockResolvedValueOnce('enabled').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('disabled')
  await render()
  await act(() => vi.advanceTimersByTimeAsync(HEARTBEAT_MS + 15_000))
  expect(stop).toHaveBeenCalledOnce()
  expect(clearVerified).toHaveBeenCalledWith('company-a')
  expect(container.textContent).toContain('Pantalla desactivada')
})

it('aborts a stalled heartbeat and prevents overlapping polls', async () => {
  vi.mocked(heartbeat).mockImplementation((_org, _id, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')))
  }))
  await render()
  await act(() => vi.advanceTimersByTimeAsync(15_000))
  expect(container.textContent).toContain('Sin conexion')
  expect(heartbeat).toHaveBeenCalledTimes(1)
})

it('preserves legacy unscoped playback without contacting control', async () => {
  await render('')
  expect(mount).toHaveBeenCalledOnce()
  expect(heartbeat).not.toHaveBeenCalled()
})
