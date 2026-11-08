export const IMAGE_PRELOAD_GRACE_MS = 5_000
export const VIDEO_STALL_MS = 20_000

export function shouldAdvanceImage(now: number, dueAt: number, nextReady: boolean): boolean {
  return now >= dueAt && (nextReady || now >= dueAt + IMAGE_PRELOAD_GRACE_MS)
}

export function shouldSkipStalledVideo(now: number, lastProgressAt: number): boolean {
  return now - lastProgressAt > VIDEO_STALL_MS
}
