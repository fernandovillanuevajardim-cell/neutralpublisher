// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fetchRemotePlaylist } from '../src/playlist'
import { requestJson } from '../src/network'
import { shortenDisplayLink } from '../src/shortLinks'

const playlistUrl = 'https://project.supabase.co/storage/v1/object/public/media/channels/principal.json'
const displayUrl = 'https://example.com/neutralpublisher/#/display?org=company-a&kiosk=1'
const playlist = { version: 1, items: [{ name: 'Cartel', kind: 'image', url: 'https://example.com/cartel.webp' }] }
const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('reads valid playlists and only requests the JSON, not the image files', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(playlist)))
  expect((await fetchRemotePlaylist(playlistUrl)).items).toHaveLength(1)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe(playlistUrl)
})
it('retries a transient network failure once', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response(JSON.stringify(playlist)))
  expect((await fetchRemotePlaylist(playlistUrl)).items).toHaveLength(1)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('bounds failures and explains connectivity instead of leaking Failed to fetch', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  await expect(fetchRemotePlaylist(playlistUrl)).rejects.toThrow('Revisa Internet')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it.each([404, 402])('does not retry HTTP %s errors', async (status) => {
  fetchMock.mockResolvedValue(new Response('{}', { status }))
  await expect(fetchRemotePlaylist(playlistUrl)).rejects.toThrow(status === 404 ? 'publica primero' : 'cuota')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
it('rejects HTML and malformed playlist URLs without retrying', async () => {
  await expect(fetchRemotePlaylist(`[${playlistUrl}](${playlistUrl})`)).rejects.toThrow('direccion completa')
  expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValue(new Response('<html>Unavailable</html>'))
  await expect(fetchRemotePlaylist(playlistUrl)).rejects.toThrow('JSON valido')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
it('honors caller cancellation without retrying', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(fetchRemotePlaylist(playlistUrl, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetchMock).not.toHaveBeenCalled()
})
it('times out stalled responses and cancels the request', async () => {
  vi.useFakeTimers()
  fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  }))
  const expectation = expect(requestJson(playlistUrl, undefined, 100)).rejects.toMatchObject({ kind: 'timeout' })
  await vi.advanceTimersByTimeAsync(100)
  await expectation
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
it('uses the CORS-compatible shortener and preserves organization and kiosk parameters', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ shorturl: 'https://is.gd/Abc123' })))
  expect(await shortenDisplayLink(displayUrl)).toBe('https://is.gd/Abc123')
  const endpoint = new URL(String(fetchMock.mock.calls[0][0]))
  expect(endpoint.origin).toBe('https://is.gd')
  expect(endpoint.searchParams.get('url')).toBe(displayUrl)
  expect(endpoint.searchParams.get('format')).toBe('json')
  expect(await shortenDisplayLink(displayUrl)).toBe('https://is.gd/Abc123')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
it('never reuses another company link', async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ shorturl: 'https://is.gd/Abc123' })))
  await shortenDisplayLink(displayUrl)
  await shortenDisplayLink(displayUrl.replace('company-a', 'company-b'))
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('does not trust an unexpected redirect host or cache failed responses', async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ shorturl: 'https://evil.example/Abc123' })))
  await expect(shortenDisplayLink(displayUrl)).rejects.toThrow('no pudo crear')
  await expect(shortenDisplayLink(displayUrl)).rejects.toThrow('no pudo crear')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('rejects local URLs and URL credentials before calling an external service', async () => {
  await expect(shortenDisplayLink('http://127.0.0.1:5174/#/display')).rejects.toThrow()
  await expect(shortenDisplayLink('https://192.168.1.10/#/display')).rejects.toThrow()
  await expect(shortenDisplayLink('https://user:secret@example.com/#/display')).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()
})
