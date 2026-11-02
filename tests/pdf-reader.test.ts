import { expect, it } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'

it('renders a full page with the patched legacy PDF reader at 200 DPI', async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const content = '0 0 1 rg 0 0 72 72 re f'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const task = getDocument({ data: new TextEncoder().encode(pdf) })
  try {
    const document = await task.promise
    const page = await document.getPage(1)
    const viewport = page.getViewport({ scale: 200 / 72 })
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    expect(canvas.width).toBe(200)
    expect(Array.from(context.getImageData(100, 100, 1, 1).data)).toEqual([0, 0, 255, 255])
  } finally {
    await task.destroy()
  }
})
