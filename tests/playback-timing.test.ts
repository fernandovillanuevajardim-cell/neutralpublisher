import { expect, it } from 'vitest'
import { IMAGE_PRELOAD_GRACE_MS, shouldAdvanceImage, shouldSkipStalledVideo, VIDEO_STALL_MS } from '../src/playbackTiming'

it('advances on time when the next image is ready', () => {
  expect(shouldAdvanceImage(7_999, 8_000, true)).toBe(false)
  expect(shouldAdvanceImage(8_000, 8_000, true)).toBe(true)
})

it('waits briefly for a slow image but never freezes forever', () => {
  expect(shouldAdvanceImage(8_000, 8_000, false)).toBe(false)
  expect(shouldAdvanceImage(8_000 + IMAGE_PRELOAD_GRACE_MS - 1, 8_000, false)).toBe(false)
  expect(shouldAdvanceImage(8_000 + IMAGE_PRELOAD_GRACE_MS, 8_000, false)).toBe(true)
})

it('skips a video only after its playback has stopped progressing', () => {
  expect(shouldSkipStalledVideo(VIDEO_STALL_MS, 0)).toBe(false)
  expect(shouldSkipStalledVideo(VIDEO_STALL_MS + 1, 0)).toBe(true)
  expect(shouldSkipStalledVideo(VIDEO_STALL_MS + 1, 10_000)).toBe(false)
})
