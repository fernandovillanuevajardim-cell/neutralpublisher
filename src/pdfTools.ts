import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

export type PdfConvertQuality = 200 | 300 | 600

type ConvertProgress = {
  page: number
  total: number
}

type ConvertPage = (file: File, progress: ConvertProgress) => Promise<void> | void

const blobFromCanvas = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error('No se pudo generar el PNG.'))
    }, 'image/png')
  })

const makeSafeBaseName = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'pdf'

export const convertPdfToPngFiles = async (
  file: File,
  quality: PdfConvertQuality,
  onProgress?: (progress: ConvertProgress) => void,
  onPage?: ConvertPage,
) => {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  const files: File[] = []
  const baseName = makeSafeBaseName(file.name)

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: quality / 72 })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })

    if (!context) {
      throw new Error('El navegador no pudo preparar el render del PDF.')
    }

    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvas, canvasContext: context, viewport }).promise

    const blob = await blobFromCanvas(canvas)
    const pngFile = new File([blob], `${baseName}-pagina-${String(pageNumber).padStart(2, '0')}-${quality}dpi.png`, {
      type: 'image/png',
      lastModified: Date.now(),
    })
    const progress = { page: pageNumber, total: pdf.numPages }

    if (onPage) {
      await onPage(pngFile, progress)
    } else {
      files.push(pngFile)
    }

    canvas.width = 1
    canvas.height = 1
    page.cleanup()
    onProgress?.(progress)
  }

  await pdf.cleanup()
  return files
}
