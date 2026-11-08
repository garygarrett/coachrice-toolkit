import { MONTSERRAT_REGULAR_B64, MONTSERRAT_BOLD_B64 } from '../accObservationReport'

/**
 * Builds a CoachRICE-branded PDF of a session transcript with the evidence the mentor coach
 * selected highlighted. Looks like the Audio to Transcript PDF (same header, fonts, footer).
 * Needs window.jspdf and the jsPDF AutoTable plugin (see src/lib/pdfLibs.js).
 *
 * data = {
 *   title, dateText, durationText, logoDataUrl,
 *   turns: [{ time, speaker, color:[r,g,b], text, pauseText, marks:[{ start, end, codes:[] }], looseCodes:[] }]
 *     marks = highlighted character ranges inside text; looseCodes = behaviors whose quote could not be found in text
 *   index: [{ code, behavior, rating, times }]   evidence index shown at the end
 * }
 */
const NAVY = [0, 32, 91]
const GRAY = [124, 126, 127]
const ORANGE = [255, 130, 0]
const HIGHLIGHT = [226, 238, 150] // soft version of the Doerr lime (c9d647)
const INK = [15, 28, 58]

// Splits one turn into runs of text: { text, hl, codes }. Overlapping marks share their text.
export function segmentTurn(text, marks) {
  const cuts = new Set([0, text.length])
  marks.forEach((m) => { cuts.add(Math.max(0, m.start)); cuts.add(Math.min(text.length, m.end)) })
  const points = [...cuts].sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    if (b <= a) continue
    const codes = [...new Set(marks.filter((m) => m.start < b && m.end > a).flatMap((m) => m.codes))]
    out.push({ text: text.slice(a, b), hl: codes.length > 0, codes })
  }
  return out
}

export function buildAnnotatedTranscriptPdf(data) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  doc.addFileToVFS('Montserrat-Regular.ttf', MONTSERRAT_REGULAR_B64)
  doc.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal')
  doc.addFileToVFS('Montserrat-Bold.ttf', MONTSERRAT_BOLD_B64)
  doc.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold')

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const margin = 44
  const contentW = W - margin * 2
  const bottom = H - 52

  // ---- Header band (same as the Audio to Transcript PDF) ----
  const bandH = 96
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, bandH, 'F')
  doc.setFillColor(105, 204, 230)
  doc.rect(0, bandH, W, 4, 'F')
  let textX = margin
  if (data.logoDataUrl) {
    const logoH = 64
    const logoW = logoH * (1161 / 1077)
    doc.addImage(data.logoDataUrl, 'PNG', margin, (bandH - logoH) / 2, logoW, logoH)
    textX = margin + logoW + 16
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('Montserrat', 'bold')
  doc.setFontSize(19)
  doc.text('Annotated Transcript', textX, 44)
  doc.setFont('Montserrat', 'normal')
  doc.setFontSize(10)
  doc.text('CoachRICE | Doerr Institute for New Leaders', textX, 62)

  // ---- Title and meta ----
  let y = bandH + 36
  doc.setTextColor(...NAVY)
  doc.setFont('Montserrat', 'bold')
  doc.setFontSize(15)
  const titleLines = doc.splitTextToSize(data.title || 'Untitled observation', contentW)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 19
  doc.setFont('Montserrat', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text([data.dateText, data.durationText ? `Session length ${data.durationText}` : ''].filter(Boolean).join('   |   '), margin, y)
  y += 22

  // ---- Key ----
  doc.setFillColor(...HIGHLIGHT)
  doc.rect(margin, y - 8, 22, 11, 'F')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  const keyLines = doc.splitTextToSize('Highlighted words are evidence selected for an ICF behavior. The orange tag after them names the behavior (for example A5.4).', contentW - 32)
  doc.text(keyLines, margin + 30, y)
  y += keyLines.length * 11 + 16

  doc.setFont('Montserrat', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('Transcript', margin, y)
  y += 12

  // ---- Transcript: drawn word by word so highlights can sit behind the evidence ----
  const FS = 9.5, LH = 14.5, TAGFS = 7.5
  const timeW = 46, nameW = 74
  const textLeft = margin + timeW + nameW
  const textW = contentW - timeW - nameW - 4

  function layout(turn) {
    const tokens = []
    const segs = segmentTurn(turn.text, turn.marks || [])
    let run = [] // behavior codes of the highlighted stretch we are in
    segs.forEach((seg, i) => {
      ;(seg.text.match(/\S+|\s+/g) || []).forEach((w) => tokens.push({ w, hl: seg.hl }))
      if (seg.hl) run = [...new Set([...run, ...seg.codes])]
      if (seg.hl && !(segs[i + 1] && segs[i + 1].hl)) { tokens.push({ w: ' ', hl: false }); tokens.push({ w: '', hl: false, code: run }); run = [] }
    })
    if (turn.looseCodes?.length) tokens.push({ w: ' ', hl: false }, { w: '', hl: false, code: turn.looseCodes })
    const lines = [[]]
    let x = 0
    tokens.forEach((t) => {
      let label = t.w
      let font = 'normal', size = FS
      if (t.code) { label = t.code.length ? `[${t.code.join(', ')}]` : ''; font = 'bold'; size = TAGFS }
      if (!label) return
      doc.setFont('Montserrat', font); doc.setFontSize(size)
      const width = doc.getTextWidth(label)
      const space = !t.code && /^\s+$/.test(label)
      if (!space && x + width > textW && lines[lines.length - 1].length) { lines.push([]); x = 0 }
      const line = lines[lines.length - 1]
      if (space && !line.length) return // no spaces at the start of a line
      line.push({ label, font, size, x, width, hl: t.hl, code: !!t.code })
      x += width
    })
    return lines
  }

  function newPage() { doc.addPage(); y = margin + 8 }

  turnsLoop: for (const turn of data.turns) {
    if (turn.pauseText) {
      if (y + 18 > bottom) newPage()
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY)
      doc.text(`[ ${turn.pauseText} ]`, W / 2, y + 8, { align: 'center' })
      y += 18
    }
    const lines = layout(turn)
    if (y + LH + 8 > bottom) newPage()
    let first = true
    y += 6
    for (const line of lines) {
      if (y + LH > bottom) { newPage(); y += 2 }
      if (first) {
        doc.setFont('Montserrat', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRAY)
        doc.text(turn.time || '', margin + 4, y + 9)
        doc.setFont('Montserrat', 'bold'); doc.setFontSize(FS); doc.setTextColor(...turn.color)
        doc.text(`${turn.speaker}:`, margin + timeW + 4, y + 9)
        first = false
      }
      // highlights first (consecutive highlighted pieces join into one band)
      line.forEach((p) => {
        if (p.hl) { doc.setFillColor(...HIGHLIGHT); doc.rect(textLeft + p.x, y - 1, p.width, LH - 1, 'F') }
      })
      line.forEach((p) => {
        doc.setFont('Montserrat', p.font); doc.setFontSize(p.size)
        doc.setTextColor(...(p.code ? ORANGE : INK))
        doc.text(p.label, textLeft + p.x, y + 9)
      })
      y += LH
    }
    y += 6
    doc.setDrawColor(226, 230, 236); doc.setLineWidth(0.5)
    doc.line(margin, y, W - margin, y)
    continue turnsLoop
  }

  // ---- Evidence index ----
  if (data.index?.length) {
    y += 30
    if (y > bottom - 80) newPage()
    doc.setFont('Montserrat', 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY)
    doc.text('Evidence index', margin, y)
    doc.autoTable({
      startY: y + 8,
      margin: { left: margin, right: margin, top: margin, bottom: 52 },
      head: [['Behavior', 'Rating', 'Evidence at']],
      body: data.index.map((r) => [`${r.code}  ${r.behavior}`, r.rating || '', r.times || 'None selected']),
      theme: 'plain',
      styles: { font: 'Montserrat', fontSize: 8.5, cellPadding: 5, textColor: INK, valign: 'top' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 242, 245] },
      columnStyles: { 0: { cellWidth: 250 }, 1: { cellWidth: 100 } },
    })
  }

  // ---- Footer on every page ----
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GRAY)
    doc.setLineWidth(0.5)
    doc.line(margin, H - 40, W - margin, H - 40)
    doc.setFont('Montserrat', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('Confidential. CoachRICE, Doerr Institute for New Leaders, Rice University', margin, H - 26)
    doc.text(`Page ${i} of ${pages}`, W - margin, H - 26, { align: 'right' })
  }
  return doc
}
