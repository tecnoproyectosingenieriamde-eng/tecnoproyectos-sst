import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'

export type AttendanceParticipant = {
  name: string
  identification: string
  cargo: string
  signature: string
}

export type AttendanceRecord = {
  activity: string
  date: string
  location: string
  responsible: string
  facilitatorName: string
  facilitatorSignature: string
  observations: string
  participants: AttendanceParticipant[]
}

function safeFileName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'registro'
}

function signatureBytes(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith('data:image/png;base64,')) return null
  const binary = atob(dataUrl.slice('data:image/png;base64,'.length))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function wrapText(value: string, maxChars: number): string[] {
  const words = (value || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current && (current + ' ' + word).length > maxChars) {
      lines.push(current)
      current = word
    } else current = current ? current + ' ' + word : word
  }
  if (current) lines.push(current)
  return lines
}

function formatDate(value: string) {
  const parts = value.split('-')
  return parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0] : value
}

export async function downloadAttendancePdf(record: AttendanceRecord) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28
  const H = 841.89
  const left = 48
  const right = W - 48
  const width = right - left
  const black = rgb(0.08, 0.08, 0.08)
  const gray = rgb(0.35, 0.35, 0.35)
  const border = rgb(0.18, 0.18, 0.18)
  const blue = rgb(0.10, 0.34, 0.55)
  const pale = rgb(0.94, 0.96, 0.97)
  const red = rgb(0.58, 0.20, 0.13)
  let page = {} as PDFPage
  let pageNo = 0
  let y = 0

  const line = (x1: number, top1: number, x2: number, top2: number, thickness = 0.55) => {
    page.drawLine({ start: { x: x1, y: H - top1 }, end: { x: x2, y: H - top2 }, thickness, color: border })
  }
  const rect = (x: number, top: number, w: number, h: number, fill?: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x, y: H - top - h, width: w, height: h, borderColor: border, borderWidth: 0.55, ...(fill ? { color: fill } : {}) })
  }
  const txt = (value: string, x: number, top: number, size = 8, font = regular, color = black, maxWidth?: number) => {
    page.drawText(value || '', { x, y: H - top - size, size, font, color, ...(maxWidth ? { maxWidth } : {}) })
  }
  const centered = (value: string, x: number, top: number, w: number, size = 8, font = bold, color = black) => {
    const textWidth = font.widthOfTextAtSize(value, size)
    txt(value, x + Math.max(3, (w - textWidth) / 2), top, size, font, color, w - 6)
  }
  let companyLogo: Awaited<ReturnType<typeof pdf.embedJpg>> | null = null
  try {
    const response = await fetch('https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg')
    if (response.ok) companyLogo = await pdf.embedJpg(new Uint8Array(await response.arrayBuffer()))
  } catch {
    // The PDF can still be generated if the external logo is unavailable.
  }
  const drawLogo = (x: number, top: number) => {
    if (companyLogo) {
      page.drawImage(companyLogo, { x: x + 1, y: H - top - 47, width: 58, height: 42 })
    } else {
      centered('TECNOPROYECTOS', x - 1, top + 18, 58, 5.8, bold, black)
      centered('INGENIERÍA S.A.S.', x - 1, top + 27, 58, 5.5, bold, blue)
    }
  }
  const header = (continuation = false) => {
    page = pdf.addPage([W, H])
    pageNo += 1
    rect(left, 34, width, 62)
    rect(left, 34, 105, 62)
    drawLogo(left + 25, 40)
    rect(left + 105, 34, 238, 62)
    centered('SISTEMA DE GESTIÓN INTEGRADO', left + 105, 42, 238, 9)
    centered('GESTIÓN DE LA SEGURIDAD Y SALUD EN EL', left + 105, 55, 238, 8.3)
    centered('TRABAJO', left + 105, 66, 238, 8.3)
    centered(continuation ? 'REGISTRO DE ASISTENCIA (CONTINUACIÓN)' : 'REGISTRO DE ASISTENCIA', left + 105, 81, 238, 9)
    const metaX = left + 343
    rect(metaX, 34, width - 343, 62)
    txt('Código: FM-SST-14', metaX + 7, 47, 8)
    txt('Versión: 01', metaX + 7, 62, 8)
    txt('Fecha: 22/06/2026', metaX + 7, 77, 8)
    if (pageNo === 1) {
      rect(left, 104, width, 23)
      const dateW = 106
      const locationW = 144
      line(left + dateW, 104, left + dateW, 127)
      line(left + dateW + locationW, 104, left + dateW + locationW, 127)
      centered('FECHA: ' + formatDate(record.date), left, 110, dateW, 8)
      centered('LUGAR: ' + (record.location || ''), left + dateW, 110, locationW, 8)
      centered('RESPONSABLE DE LA ACTIVIDAD:', left + dateW + locationW, 106, width - dateW - locationW, 7.5)
      centered(record.responsible || '', left + dateW + locationW, 116, width - dateW - locationW, 7.5, regular)
      rect(left, 127, width, 38)
      txt('TEMA / ACTIVIDAD:', left + 5, 132, 8, bold)
      const topicLines = wrapText(record.activity, 95).slice(0, 2)
      topicLines.forEach((t, i) => txt(t, left + 100, 133 + i * 11, 8, regular, black, width - 106))
      y = 165
    } else {
      y = 112
    }
  }
  const tableHeader = () => {
    const xs = [left, left + 140, left + 248, left + 340, right]
    rect(left, y, width, 20, pale)
    centered('ASISTENTES', xs[0], y + 5, xs[1] - xs[0], 8)
    centered('No IDENTIFICACIÓN', xs[1], y + 5, xs[2] - xs[1], 7.5)
    centered('CARGO', xs[2], y + 5, xs[3] - xs[2], 8)
    centered('FIRMA', xs[3], y + 5, xs[4] - xs[3], 8)
    xs.slice(1, -1).forEach((x) => line(x, y, x, y + 20))
    y += 20
  }
  const drawPerson = async (person: AttendanceParticipant) => {
    const xs = [left, left + 140, left + 248, left + 340, right]
    const rowHeight = 17
    rect(left, y, width, rowHeight)
    xs.slice(1, -1).forEach((x) => line(x, y, x, y + rowHeight))
    txt(person.name.slice(0, 42), xs[0] + 4, y + 4, 7.2, regular, black, xs[1] - xs[0] - 8)
    txt(person.identification.slice(0, 25), xs[1] + 4, y + 4, 7.2, regular, black, xs[2] - xs[1] - 8)
    txt(person.cargo.slice(0, 22), xs[2] + 4, y + 4, 7.2, regular, black, xs[3] - xs[2] - 8)
    const bytes = signatureBytes(person.signature)
    if (bytes) {
      try {
        const image = await pdf.embedPng(bytes)
        page.drawImage(image, { x: xs[3] + 4, y: H - y - rowHeight + 2, width: Math.min(75, xs[4] - xs[3] - 8), height: rowHeight - 4 })
      } catch {
        txt('Firma no válida', xs[3] + 4, y + 4, 6, regular, gray)
      }
    }
    y += rowHeight
  }

  const people = record.participants.filter((p) => p.name.trim() || p.identification.trim() || p.cargo.trim() || p.signature)
  header()
  tableHeader()
  for (let i = 0; i < people.length; i += 1) {
    if ((pageNo === 1 && i >= 22) || (pageNo > 1 && y + 17 > 760)) {
      header(true)
      tableHeader()
    }
    await drawPerson(people[i])
  }
  // Completa las filas vacías de la primera página, como en la plantilla impresa.
  if (pageNo === 1 && people.length < 22) {
    const blank: AttendanceParticipant = { name: '', identification: '', cargo: '', signature: '' }
    for (let i = people.length; i < 22; i += 1) await drawPerson(blank)
  }

  // Mantiene un área amplia para observaciones y los dos campos de cierre del formato.
  if (y + 110 > 785) {
    header(true)
    tableHeader()
  }
  const observationsTop = Math.max(y + 5, 555)
  const safeObsTop = Math.min(observationsTop, 650)
  const obsHeight = 83
  rect(left, safeObsTop, width, obsHeight)
  centered('OBSERVACIONES', left, safeObsTop + 3, width, 8)
  for (let row = 1; row <= 5; row += 1) line(left, safeObsTop + 18 + row * 12, right, safeObsTop + 18 + row * 12, 0.4)
  wrapText(record.observations, 105).slice(0, 5).forEach((value, index) => txt(value, left + 5, safeObsTop + 20 + index * 11, 7.5, regular, black, width - 10))
  const footerTop = safeObsTop + obsHeight
  rect(left, footerTop, width / 2, 42)
  rect(left + width / 2, footerTop, width / 2, 42)
  txt('NOMBRE COMPLETO DEL FACILITADOR:', left + 4, footerTop + 4, 7.3, bold)
  txt(record.facilitatorName || '', left + 4, footerTop + 21, 8, bold, black, width / 2 - 8)
  txt('FIRMA FACILITADOR:', left + width / 2 + 4, footerTop + 4, 7.3, bold)
  const facilitatorBytes = signatureBytes(record.facilitatorSignature)
  if (facilitatorBytes) {
    try {
      const image = await pdf.embedPng(facilitatorBytes)
      page.drawImage(image, { x: left + width / 2 + 8, y: H - footerTop - 39, width: width / 2 - 16, height: 30 })
    } catch { /* leave the official signature space blank if image data is invalid */ }
  }
  txt('BORRADOR DIGITAL PARA VALIDACIÓN INTERNA · FM-SST-14 · Página ' + pageNo, left, 807, 6.2, regular, red)
  const bytes = await pdf.save()
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'FM-SST-14-' + safeFileName(record.activity) + '.pdf'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
