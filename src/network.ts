export class RequestError extends Error {
  kind: 'network' | 'timeout' | 'http' | 'json'
  status?: number
  constructor(kind: RequestError['kind'], message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

export function parseHttpUrl(value: string): URL {
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error('Pega una direccion completa que empiece con https://, sin texto adicional.') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Usa un enlace HTTP o HTTPS sin credenciales.')
  }
  if (typeof location !== 'undefined' && location.protocol === 'https:' && url.protocol !== 'https:') {
    throw new Error('El enlace debe usar HTTPS para abrirlo desde esta web segura.')
  }
  return url
}

// Bound the complete response, including body reading, and preserve caller cancellation.
export async function requestJson(url: string, signal?: AbortSignal, timeoutMs = 15_000): Promise<unknown> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  signal?.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: controller.signal })
    if (!response.ok) throw new RequestError('http', `El servidor respondio con el codigo ${response.status}.`, response.status)
    const text = await response.text()
    try { return JSON.parse(text) } catch { throw new RequestError('json', 'El enlace no devuelve un archivo JSON valido.') }
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (timedOut) throw new RequestError('timeout', 'La conexion tardo demasiado. Volve a intentar.')
    if (error instanceof RequestError) throw error
    throw new RequestError('network', 'No se pudo conectar. Revisa Internet y que el servidor permita conexiones desde esta web (CORS).')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
