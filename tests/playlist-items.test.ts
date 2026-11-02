import { expect, it } from 'vitest'
import { reconcilePlaylistItems, samePlaylistItems } from '../src/playlistItems'
import type { RemotePlaylistItem } from '../src/types'

const image = (name: string): RemotePlaylistItem => ({
  name, kind: 'image', url: `https://example.com/${name}.webp`, mimeType: 'image/webp',
})

it('keeps every image identity when a TV polls the unchanged published pack', () => {
  const pack = [image('one'), image('two')]
  const first = reconcilePlaylistItems([], pack)
  const second = reconcilePlaylistItems(first, pack)
  expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id))
  expect(samePlaylistItems(first, second)).toBe(true)
})

it('updates a new pack while retaining identities of reused images', () => {
  const oldPack = reconcilePlaylistItems([], [image('one'), image('two')])
  const newPack = reconcilePlaylistItems(oldPack, [image('two'), image('three')])
  expect(newPack[0].id).toBe(oldPack[1].id)
  expect(newPack[1].id).not.toBe(oldPack[0].id)
  expect(newPack[1].id).not.toBe(oldPack[1].id)
  expect(samePlaylistItems(oldPack, newPack)).toBe(false)
})

it('does not collapse repeated copies of the same image', () => {
  const duplicate = image('repeated')
  const oldPack = reconcilePlaylistItems([], [duplicate, duplicate])
  const newPack = reconcilePlaylistItems(oldPack, [duplicate, duplicate])
  expect(newPack.map((item) => item.id)).toEqual(oldPack.map((item) => item.id))
  expect(new Set(newPack.map((item) => item.id)).size).toBe(2)
})

it('recognizes changes to slide timing without fetching a new image', () => {
  const oldPack = reconcilePlaylistItems([], [image('one')])
  const newPack = reconcilePlaylistItems(oldPack, [{ ...image('one'), durationSeconds: 12 }])
  expect(newPack[0].id).toBe(oldPack[0].id)
  expect(samePlaylistItems(oldPack, newPack)).toBe(false)
})
