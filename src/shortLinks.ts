import { parseHttpUrl, requestJson } from './network'

const cacheKey = 'neutralpublisher-short-links-v1'
const validShortLink = (value: unknown): value is string =>
  typeof value === 'string' && /^https:\/\/is\.gd\/[A-Za-z0-9_]{5,30}$/.test(value)

function readCache(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

export async function shortenDisplayLink(value: string): Promise<string> {
  const target = parseHttpUrl(value)
  if (target.protocol !== 'https:' || target.hostname === 'localhost' || target.hostname.endsWith('.local') ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(target.hostname) || target.hostname.includes(':')) {
    throw new Error('Para acortar usa el enlace HTTPS publico, no una direccion local.')
  }
  const url = target.href
  const cache = readCache()
  if (validShortLink(cache[url])) return cache[url]
  const endpoint = new URL('https://is.gd/create.php')
  endpoint.searchParams.set('format', 'json')
  endpoint.searchParams.set('url', url)
  const data = await requestJson(endpoint.href)
  if (!data || typeof data !== 'object' || !('shorturl' in data) || !validShortLink(data.shorturl)) {
    throw new Error('El servicio no pudo crear el enlace corto. Podes copiar el enlace completo y reintentar mas tarde.')
  }
  const result = data.shorturl
  // Keep a bounded cache keyed by the full destination, including organization and kiosk mode.
  try {
    const entries = Object.entries(cache).filter(([, link]) => validShortLink(link)).slice(-49)
    localStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries([...entries, [url, result]])))
  } catch { /* The returned link remains usable when browser storage is unavailable. */ }
  return result
}
