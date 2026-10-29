import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const signatureImages: { label: string; data: string }[] = []
const clean = (value: unknown, label = 'Firma'): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    signatureImages.push({ label, data: value })
    return '[Firma incorporada al final del PDF]'
  }
  if (Array.isArray(value)) return value.map((item, i) => `${i + 1}. ${clean(item, label)}`).join(' | ')
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key}: ${clean(item, key)}`).join('; ')
  return String(value)
}

export async function downloadSimpleFormPdf(code: string, title: string, data: Record<string, unknown>): Promise<Blob> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const width = 595.28, height = 841.89, margin = 42
  let page = pdf.addPage([width, height]), y = height - margin
  const drawLine = (text: string, strong = false) => {
    const maxWidth = width - margin * 2
    const words = text.replace(/[\r\n]+/g, ' ').split(/\s+/)
    let line = ''
    const lines: string[] = []
    for (const word of words) {
      const next = line ? line + ' ' + word : word
      if ((strong ? bold : font).widthOfTextAtSize(next, 9) > maxWidth && line) { lines.push(line); line = word } else line = next
    }
    if (line) lines.push(line)
    for (const part of lines) {
      if (y < margin + 35) { page = pdf.addPage([width, height]); y = height - margin }
      page.drawText(part.slice(0, 300), { x: margin, y, size: strong ? 10 : 9, font: strong ? bold : font, color: rgb(0.12, 0.2, 0.28) })
      y -= strong ? 17 : 13
    }
  }
  drawLine('TECNOPROYECTOS INGENIERÍA S.A.S.', true)
  drawLine(code + ' · ' + title, true)
  drawLine('BORRADOR DIGITAL PARA VALIDACIÓN INTERNA · NO ES REGISTRO OFICIAL')
  drawLine('Generado: ' + new Date().toLocaleString('es-CO'))
  y -= 8
  for (const [key, value] of Object.entries(data)) {
    drawLine(key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').toUpperCase(), true)
    drawLine(clean(value))
    y -= 3
  }
  for (const signature of signatureImages) {
    if (y < margin + 70) { page = pdf.addPage([width, height]); y = height - margin }
    drawLine('FIRMA: ' + signature.label, true)
    try {
      const base64 = signature.data.split(',')[1]
      const binary = atob(base64)
      const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
      const image = signature.data.startsWith('data:image/jpeg') || signature.data.startsWith('data:image/jpg')
        ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
      page.drawImage(image, { x: margin, y: y - 42, width: 145, height: 38 })
      y -= 52
    } catch { drawLine('[No fue posible incrustar la imagen de la firma]') }
  }
  const pages = pdf.getPages()
  pages.forEach((p, i) => p.drawText('BORRADOR · Página ' + (i + 1) + ' de ' + pages.length, { x: margin, y: 18, size: 7, font, color: rgb(0.45, 0.45, 0.45) }))
  const bytes = await pdf.save()
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = code + '-BORRADOR.pdf'
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  return blob
}
