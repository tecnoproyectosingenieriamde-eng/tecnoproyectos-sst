import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

type Signature = { label: string; value?: string }
const LOGO_URL = 'https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg'
const clean = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return ''
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ' ')
}

export async function downloadSimpleFormPdf(code: string, title: string, data: Record<string, unknown>): Promise<Blob> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let logo: Awaited<ReturnType<typeof pdf.embedJpg>> | null = null
  try { const response = await fetch(LOGO_URL); if (response.ok) logo = await pdf.embedJpg(new Uint8Array(await response.arrayBuffer())) } catch { /* Mantener encabezado de texto si el logo no está disponible. */ }
  const W = 595.28, H = 841.89, margin = 28, usable = W - margin * 2
  let page: PDFPage
  let y = 0
  const blue = rgb(0.88, 0.93, 0.98), border = rgb(0.35, 0.42, 0.50), ink = rgb(0.08, 0.12, 0.17)
  const wrap = (value: unknown, maxWidth: number, size: number, face: PDFFont = font) => {
    const words = clean(value).split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const next = line ? line + ' ' + word : word
      if (line && face.widthOfTextAtSize(next, size) > maxWidth) { lines.push(line); line = word } else line = next
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['—']
  }
  const text = (value: unknown, x: number, top: number, size = 8, face: PDFFont = font, maxWidth?: number) => {
    const valueClean = clean(value)
    page.drawText(valueClean.slice(0, 500), { x, y: H - top - size, size, font: face, color: ink, ...(maxWidth ? { maxWidth } : {}) })
  }
  const startPage = () => {
    page = pdf.addPage([W, H])
    y = 26
    page.drawRectangle({ x: margin, y: H - y - 56, width: usable, height: 56, borderColor: border, borderWidth: 0.7 })
    page.drawRectangle({ x: margin, y: H - y - 56, width: 104, height: 56, borderColor: border, borderWidth: 0.5 })
    if (logo) {
      const scale = Math.min((104 - 10) / logo.width, 46 / logo.height)
      page.drawImage(logo, { x: margin + (104 - logo.width * scale) / 2, y: H - y - 5 - logo.height * scale, width: logo.width * scale, height: logo.height * scale })
    } else {
      text('TECNOPROYECTOS', margin + 7, y + 17, 8, bold)
      text('INGENIERIA S.A.S.', margin + 7, y + 29, 7, bold)
    }
    page.drawRectangle({ x: margin + 104, y: H - y - 56, width: usable - 205, height: 56, borderColor: border, borderWidth: 0.5 })
    text('SISTEMA DE GESTION INTEGRADO', margin + 111, y + 7, 7, bold)
    text('SEGURIDAD Y SALUD EN EL TRABAJO', margin + 111, y + 18, 6.5, bold)
    text(title.toUpperCase(), margin + 111, y + 31, 7, bold, usable - 220)
    page.drawRectangle({ x: W - margin - 101, y: H - y - 56, width: 101, height: 56, borderColor: border, borderWidth: 0.5 })
    text('Codigo: ' + code, W - margin - 96, y + 8, 6.5, bold)
    text('Version: 01', W - margin - 96, y + 21, 6.5)
    text('Fecha: 22/06/2026', W - margin - 96, y + 34, 6)
    y += 64
    text('BORRADOR DIGITAL PARA VALIDACION INTERNA - NO ES REGISTRO OFICIAL', margin, y, 6, font, usable)
    y += 14
  }
  const section = (label: string) => {
    page.drawRectangle({ x: margin, y: H - y - 16, width: usable, height: 16, borderColor: border, borderWidth: 0.5, color: blue })
    text(label, margin + 5, y + 4, 8, bold)
    y += 20
  }
  const drawChoiceMarks = (x: number, top: number, width: number, height: number, options: string[], selected: string, size = 5.4) => {
    const box = 6, gap = 3
    const labelWidths = options.map(option => font.widthOfTextAtSize(option, size))
    const total = options.reduce((sum, _, i) => sum + box + 2 + labelWidths[i] + (i ? gap : 0), 0)
    const scale = total > width ? width / total : 1
    let cx = x
    options.forEach((option, i) => {
      const b = box * scale, fs = size * scale
      const chosen = selected.trim().toLowerCase().replace(/_/g, ' ') === option.toLowerCase().replace(/_/g, ' ')
      page.drawRectangle({ x: cx, y: H - top - b - (height - b) / 2, width: b, height: b, borderColor: border, borderWidth: 0.65, ...(chosen ? { color: rgb(0.82, 0.89, 0.96) } : {}) })
      if (chosen) { page.drawLine({ start: { x: cx + b * .18, y: H - top - height / 2 }, end: { x: cx + b * .42, y: H - top - height / 2 - b * .22 }, thickness: .8, color: ink }); page.drawLine({ start: { x: cx + b * .42, y: H - top - height / 2 - b * .22 }, end: { x: cx + b * .84, y: H - top - height / 2 + b * .27 }, thickness: .8, color: ink }) }
      cx += b + 2 * scale
      text(option, cx, top + (height - fs) / 2, fs)
      cx += labelWidths[i] * scale + gap * scale
    })
  }
  const fields = (items: [string, unknown][], cols = 2) => {
    const cw = usable / cols
    for (let i = 0; i < items.length; i += cols) {
      const group = items.slice(i, i + cols)
      const h = 29
      if (y + h > H - 36) { startPage() }
      group.forEach(([label, value], j) => {
        const x = margin + j * cw
        page.drawRectangle({ x, y: H - y - h, width: cw, height: h, borderColor: border, borderWidth: 0.4 })
        const labelWidth = Math.min(104, cw * 0.38)
        page.drawRectangle({ x, y: H - y - h, width: labelWidth, height: h, borderColor: border, borderWidth: 0.3, color: blue })
        text(label.toUpperCase(), x + 4, y + 4, 5.6, bold, Math.min(96, cw * 0.35))
        const valX = x + Math.min(108, cw * 0.4)
        const valueWidth = cw - (valX - x) - 5
        if (String(label).toLowerCase().includes('resultado')) {
          const selected = String(value ?? '')
          const options = code === 'FM-SST-45' ? ['AUTORIZADO', 'SUSPENDIDO'] : code === 'FM-SST-46' ? ['APTA', 'NO APTA'] : ['APTO', 'NO APTO']
          const selectedLabel = code === 'FM-SST-45' ? (selected === 'authorized' ? 'AUTORIZADO' : selected === 'stopped' ? 'SUSPENDIDO' : '') : selected === 'NO_APTA' || selected === 'NO_APTO' ? (code === 'FM-SST-46' ? 'NO APTA' : 'NO APTO') : selected === 'APTA' || selected === 'APTO' ? (code === 'FM-SST-46' ? 'APTA' : 'APTO') : ''
          drawChoiceMarks(valX, y + 4, valueWidth, h - 8, options, selectedLabel, 5.3)
        } else {
          wrap(value, valueWidth, 7).slice(0, 2).forEach((line, k) => text(line, valX, y + 6 + k * 9, 7))
        }
      })
      y += h
    }
    y += 5
  }
  const table = (headers: string[], rows: unknown[][], widths?: number[]) => {
    const ratios = widths || headers.map(() => 1 / headers.length)
    const colWidths = ratios.map(r => usable * r)
    const optionsFor = (header: string): string[] | null => {
      const h = header.toLowerCase()
      if (h.includes('capacitacion ta') || h === 'cumple') return ['Sí', 'No', 'N/A']
      if (h.includes('verificacion')) return ['Sí', 'No']
      if (h === 'estado' || h.includes('c/nc')) return ['C', 'NC', 'N/A']
      return null
    }
    const drawRow = (cells: unknown[], header = false) => {
      const size = header ? 6.4 : 6.5
      const lineSets = cells.map((v, i) => wrap(v, colWidths[i] - 7, size, header ? bold : font))
      const choiceCols = cells.map((_, i) => !header ? optionsFor(headers[i]) : null)
      const lines = Math.max(1, ...lineSets.map((a, i) => choiceCols[i] ? 1 : Math.min(a.length, 12)))
      const h = Math.max(header ? 25 : 23, lines * (size + 2) + 7)
      if (y + h > H - 34) startPage()
      let x = margin
      cells.forEach((cell, i) => {
        page.drawRectangle({ x, y: H - y - h, width: colWidths[i], height: h, borderColor: border, borderWidth: 0.4, ...(header ? { color: blue } : {}) })
        if (choiceCols[i]) drawChoiceMarks(x + 3.5, y + 4, colWidths[i] - 7, h - 8, choiceCols[i]!, String(cell ?? ''), 5.1)
        else lineSets[i].slice(0, 12).forEach((line, j) => text(line, x + 3.5, y + 4 + j * (size + 2), size, header ? bold : font, colWidths[i] - 7))
        x += colWidths[i]
      })
      y += h
    }
    drawRow(headers, true)
    rows.forEach(row => drawRow(row))
    y += 7
  }
  const participantTable = async (people: Record<string, unknown>[]) => {
    const ratios = [0.24, 0.15, 0.2, 0.19, 0.22]
    const headers = ['Nombre', 'Cedula', 'Cargo / rol', 'Capacitacion TA', 'Firma']
    const widths = ratios.map(r => usable * r)
    const drawRow = async (cells: unknown[], isHeader = false) => {
      const h = isHeader ? 25 : 38
      if (y + h > H - 34) startPage()
      let x = margin
      for (let i = 0; i < cells.length; i++) {
        page.drawRectangle({ x, y: H - y - h, width: widths[i], height: h, borderColor: border, borderWidth: 0.4, ...(isHeader ? { color: blue } : {}) })
        const value = cells[i]
        if (!isHeader && i === 4 && typeof value === 'string' && value.startsWith('data:image/')) {
          try {
            const bytes = Uint8Array.from(atob(value.split(',')[1]), ch => ch.charCodeAt(0))
            const image = value.startsWith('data:image/jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
            const scale = Math.min((widths[i] - 8) / image.width, (h - 8) / image.height)
            page.drawImage(image, { x: x + (widths[i] - image.width * scale) / 2, y: H - y - h + (h - image.height * scale) / 2, width: image.width * scale, height: image.height * scale })
          } catch { text('Firma no disponible', x + 3, y + 14, 5) }
        } else {
          wrap(value, widths[i] - 7, isHeader ? 6.4 : 6.5, isHeader ? bold : font).slice(0, isHeader ? 2 : 4).forEach((line, j) => text(line, x + 3.5, y + (isHeader ? 7 : 4) + j * 8, isHeader ? 6.4 : 6.5, isHeader ? bold : font, widths[i] - 7))
        }
        x += widths[i]
      }
      y += h
    }
    await drawRow(headers, true)
    for (const p of people) await drawRow([p.name, p.id, p.role, p.training, p.signature])
    y += 7
  }
  const signatureBoxes = async (items: Signature[]) => {
    const gap = 8, cw = (usable - gap * (items.length - 1)) / items.length, h = 77
    if (y + h > H - 38) startPage()
    for (let i = 0; i < items.length; i++) {
      const item = items[i], x = margin + i * (cw + gap)
      page.drawRectangle({ x, y: H - y - h, width: cw, height: h, borderColor: border, borderWidth: 0.5 })
      text(item.label, x + 5, y + 5, 7, bold, cw - 10)
      page.drawLine({ start: { x: x + 5, y: H - y - 47 }, end: { x: x + cw - 5, y: H - y - 47 }, thickness: 0.5, color: border })
      const value = item.value || ''
      if (value.startsWith('data:image/')) {
        try {
          const bytes = Uint8Array.from(atob(value.split(',')[1]), ch => ch.charCodeAt(0))
          const image = value.startsWith('data:image/jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
          const scale = Math.min((cw - 14) / image.width, 30 / image.height)
          page.drawImage(image, { x: x + 7, y: H - y - 43, width: image.width * scale, height: image.height * scale })
        } catch { text('Firma no disponible', x + 5, y + 25, 6) }
      }
      text(item.label.toUpperCase(), x + 5, y + 56, 5.4, font, cw - 10)
    }
    y += h + 8
  }

  startPage()
  if (code === 'FM-SST-45') {
    section('DATOS GENERALES DEL ANALISIS DE TRABAJO SEGURO')
    fields([['Fecha', data.date], ['Hora inicio', data.time], ['Lugar / frente', data.place], ['Orden de trabajo', data.order], ['Actividad', data.activity], ['Altura aproximada (m)', data.height], ['Responsable de la tarea', data.responsible], ['Coordinador TA', data.coordinator]])
    section('1. PERSONAL PARTICIPANTE')
    const people = Array.isArray(data.people) ? data.people as Record<string, unknown>[] : []
    await participantTable(people)
    section('2. ANALISIS DE PELIGROS, RIESGOS Y CONTROLES')
    const hazards = Array.isArray(data.hazards) ? data.hazards as Record<string, unknown>[] : []
    table(['Etapa / tarea', 'Peligro', 'Consecuencia', 'Controles requeridos', 'Verificacion'], hazards.map(h => [h.task, h.hazard, h.consequence, h.controls, h.verification]), [0.16, 0.18, 0.18, 0.34, 0.14])
    startPage()
    section('3. VERIFICACIONES PREVIAS Y RECURSOS')
    const checks = Array.isArray(data.checks) ? data.checks as Record<string, unknown>[] : []
    table(['Item', 'Cumple', 'Observaciones'], checks.map(v => [v.item, v.status, v.notes]), [0.58, 0.2, 0.22])
    section('4. AUTORIZACION / REVALIDACION')
    fields([['Resultado ATS', data.authorization], ['Trabajador autorizado', data.workerName], ['Coordinador TA', data.coordinator], ['Responsable que autoriza', data.authorizerName], ['Responsable de emergencias', data.emergencyName], ['Telefono de emergencia', data.emergencyPhone]])
    await signatureBoxes([{ label: 'Firma trabajador autorizado', value: String(data.workerSignature || '') }, { label: 'Firma coordinador TA', value: String(data.coordinatorSignature || '') }, { label: 'Firma responsable que autoriza', value: String(data.authorizerSignature || '') }])
  } else if (code === 'FM-SST-46') {
    section('DATOS DE IDENTIFICACION DE LA ESCALERA')
    fields([['Fecha', data.date], ['Ubicacion', data.location], ['Codigo / ID escalera', data.ladderId], ['Marca / serial', data.brand], ['Inspector', data.inspector], ['Cargo', data.role], ['Tipo de escalera', data.kind], ['Longitud / capacidad', data.lengthCapacity]])
    section('1. INSPECCION PREUSO / PERIODICA')
    const rows = Array.isArray(data.rows) ? data.rows as Record<string, unknown>[] : []
    table(['N.º', 'Componente / criterio', 'Condicion esperada', 'Estado', 'Observacion / accion'], rows.map((r, i) => [i + 1, r.name, r.expected, r.status, r.observation]), [0.06, 0.2, 0.34, 0.1, 0.3])
    section('2. RESULTADO Y SEGUIMIENTO')
    fields([['Resultado', data.result], ['Responsable / coordinador', data.coordinator], ['Accion correctiva / mantenimiento', data.corrective], ['Fecha de cierre', data.closeDate]])
    await signatureBoxes([{ label: 'Firma del inspector', value: String(data.inspectorSign || '') }, { label: 'Firma del responsable / coordinador', value: String(data.coordinatorSign || '') }])
  } else {
    section('DATOS GENERALES DE LA INSPECCION')
    fields([['Fecha', data.date], ['Lugar', data.place], ['Trabajador', data.worker], ['Cargo / rol', data.role], ['Inspector', data.inspector], ['Tipo de inspeccion', data.type]])
    section('1. INSPECCION DE EPP Y EQUIPOS CONTRA CAIDAS')
    const rows = Array.isArray(data.rows) ? data.rows as Record<string, unknown>[] : []
    table(['Elemento / equipo', 'Criterio de inspeccion', 'Estado', 'ID / serial', 'Observacion'], rows.map(r => [r.name, r.criterion, r.status, r.id, r.observation]), [0.21, 0.37, 0.12, 0.13, 0.17])
    section('2. RESULTADO Y FIRMAS')
    fields([['Resultado', data.result], ['Inspector', data.signatureInspector], ['Trabajador', data.signatureWorker], ['Responsable / coordinador', data.coordinator]])
    await signatureBoxes([{ label: 'Firma del inspector', value: String(data.inspectorSign || '') }, { label: 'Firma del trabajador', value: String(data.workerSign || '') }, { label: 'Firma responsable / coordinador', value: String(data.coordSign || '') }])
  }
  const pages = pdf.getPages()
  pages.forEach((p, i) => p.drawText('BORRADOR - Pagina ' + (i + 1) + ' de ' + pages.length, { x: margin, y: 14, size: 6.5, font, color: rgb(0.45, 0.45, 0.45) }))
  const bytes = await pdf.save()
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = code + '-BORRADOR.pdf'
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  return blob
}
