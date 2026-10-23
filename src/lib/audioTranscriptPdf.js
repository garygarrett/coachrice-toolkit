import { MONTSERRAT_REGULAR_B64, MONTSERRAT_BOLD_B64 } from './accObservationReport'

/**
 * Builds a CoachRICE-branded PDF of an edited audio transcript.
 * Needs window.jspdf and the jsPDF AutoTable plugin to be loaded (see the page).
 * Returns the jsPDF document; call .save('name.pdf') on it.
 *
 * data = {
 *   title, dateText, durationText,
 *   logoDataUrl,                       optional white logo (PNG data URL)
 *   speakers: [{ name, color, timeText, timePct, words, wordPct, turns }],
 *   showTime,                          show the time columns
 *   silence: { totalText, pctText, longestText } | null,
 *   rows: [{ time, speaker, color, text, pauseText }],  pauseText = '' or '8 sec pause'
 * }
 */
const NAVY = [0, 32, 91]
const GRAY = [124, 126, 127]
const LIGHT = [240, 242, 245]

export function buildTranscriptPdf(data) {
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

  // ---- Header band on page 1 ----
  const bandH = 96
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, bandH, 'F')
  doc.setFillColor(105, 204, 230) // sky accent line
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
  doc.text('Session Transcript', textX, 44)
  doc.setFont('Montserrat', 'normal')
  doc.setFontSize(10)
  doc.text('CoachRICE | Doerr Institute for New Leaders', textX, 62)

  // ---- Title and meta ----
  let y = bandH + 36
  doc.setTextColor(...NAVY)
  doc.setFont('Montserrat', 'bold')
  doc.setFontSize(15)
  const titleLines = doc.splitTextToSize(data.title || 'Untitled transcript', contentW)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 19
  doc.setFont('Montserrat', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text([data.dateText, data.durationText ? `Recording length ${data.durationText}` : ''].filter(Boolean).join('   |   '), margin, y)
  y += 20

  // ---- Who did the talking ----
  doc.setFont('Montserrat', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('Who did the talking', margin, y)
  y += 8

  const head = data.showTime
    ? [['Speaker', 'Speaking time', '% of time', 'Words', '% of words', 'Turns']]
    : [['Speaker', 'Words', '% of words', 'Turns']]
  const body = data.speakers.map((s) =>
    data.showTime
      ? [s.name, s.timeText, `${s.timePct.toFixed(0)}%`, s.words.toLocaleString('en-US'), `${s.wordPct.toFixed(0)}%`, String(s.turns)]
      : [s.name, s.words.toLocaleString('en-US'), `${s.wordPct.toFixed(0)}%`, String(s.turns)])
  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: 'plain',
    styles: { font: 'Montserrat', fontSize: 9, cellPadding: 6, textColor: [15, 28, 58] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: Object.fromEntries(head[0].map((_, i) => [i, { halign: i === 0 ? 'left' : 'right' }])),
    didParseCell: (c) => {
      if (c.section === 'head') c.cell.styles.halign = c.column.index === 0 ? 'left' : 'right'
      if (c.section === 'body' && c.column.index === 0) {
        c.cell.styles.fontStyle = 'bold'
        c.cell.styles.textColor = data.speakers[c.row.index].color
      }
    },
  })
  y = doc.lastAutoTable.finalY

  if (data.silence) {
    y += 14
    doc.setFont('Montserrat', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    const line = `Silence: ${data.silence.totalText}${data.silence.pctText ? ` (${data.silence.pctText} of the recording)` : ''}   |   Longest pause: ${data.silence.longestText}`
    doc.text(doc.splitTextToSize(line, contentW), margin, y)
    y += 4
  }

  // ---- Transcript ----
  y += 28
  if (y > H - 140) { doc.addPage(); y = margin + 8 }
  doc.setFont('Montserrat', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('Transcript', margin, y)
  y += 8

  const tBody = []
  data.rows.forEach((r) => {
    if (r.pauseText) {
      tBody.push([{ content: `[ ${r.pauseText} ]`, colSpan: 3, styles: { halign: 'center', fontStyle: 'normal', textColor: GRAY, fontSize: 8, cellPadding: 3 } }])
    }
    tBody.push([r.time, { content: r.speaker, styles: { textColor: r.color } }, r.text])
  })
  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 52 },
    body: tBody,
    theme: 'plain',
    styles: { font: 'Montserrat', fontSize: 9.5, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 }, textColor: [15, 28, 58], lineColor: [226, 230, 236], lineWidth: { bottom: 0.5 }, valign: 'top' },
    columnStyles: {
      0: { cellWidth: 46, textColor: GRAY, fontSize: 8.5 },
      1: { cellWidth: 74, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
    },
  })

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
