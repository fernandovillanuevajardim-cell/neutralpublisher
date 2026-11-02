// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { loadDisplayPlaylist, saveDisplayPlaylist, toDisplayItems } from '../src/displayPlaylistCache'
import { defaultSettings, type RemotePlaylist } from '../src/types'

const playlist: RemotePlaylist = {
  version: 1,
  name: 'Sucursal',
  settings: defaultSettings,
  items: [{ name: 'Aviso', kind: 'image', url: 'https://example.com/aviso.webp' }],
}
const url = 'https://example.com/principal.json'

beforeEach(() => localStorage.clear())

it('restores the same company playlist after browser restart without a network request', () => {
  saveDisplayPlaylist('company-a', url, playlist)
  const restored = loadDisplayPlaylist('company-a', url)
  expect(restored?.items[0].url).toBe(playlist.items[0].url)
  expect(toDisplayItems('company-a', restored!)[0].previewUrl).toBe(playlist.items[0].url)
})

it('never uses another company or channel cached playlist', () => {
  saveDisplayPlaylist('company-a', url, playlist)
  expect(loadDisplayPlaylist('company-b', url)).toBeNull()
  expect(loadDisplayPlaylist('company-a', 'https://example.com/other.json')).toBeNull()
})

it('ignores a damaged cache and accepts a newly published pack', () => {
  localStorage.setItem('neutralpublisher-display-playlist-v1:company-a', 'bad JSON')
  expect(loadDisplayPlaylist('company-a', url)).toBeNull()
  saveDisplayPlaylist('company-a', url, { ...playlist, items: [{ name: 'Nuevo', kind: 'image', url: 'https://example.com/new.webp' }] })
  expect(loadDisplayPlaylist('company-a', url)?.items[0].name).toBe('Nuevo')
})
