// Fills the ORIGINAL ICF Mentor Coaching Competency Review Form (a Word file) in the browser.
// Same approach as src/lib/sof/fillDocx.js: a .docx is a zip, the form's check boxes and text
// boxes are Word "content controls" that we find in document order, and everything else
// (fonts, layout, headers) stays exactly as ICF made it. If ICF publishes a new version of the
// template, re-map the control order below.

import JSZip from 'jszip'
import { BEHAVIORS, COMPETENCIES, LEVELS, totalHours, SESSION_ROWS } from './crfSpec'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml'
const XML_SPACE = 'http://www.w3.org/XML/1998/namespace'
export const EXPECTED_CONTROLS = 88

// Position of each control in the template (document order).
const SDT = { level: 0, selfReview: 3, c1: 6, c1Notes: 8, statementsStart: 9, feedback: 61, overall: 85, reviewed: 87 }

// Each competency is: one Demonstrated/Not-yet pair per statement, then one Yes/No pair.
export function competencyControls() {
  const out = {}
  let at = SDT.statementsStart
  COMPETENCIES.forEach((c) => {
    const items = BEHAVIORS.filter((b) => b.comp === c.n)
    out[c.n] = { statements: items.map((b, i) => ({ id: b.id, at: at + i * 2 })), met: at + items.length * 2 }
    at += items.length * 2 + 2
  })
  if (at !== SDT.feedback) throw new Error('Competency Review Form control map is out of step with the template.')
  return out
}

const kids = (el, name) => Array.from(el.childNodes).filter((n) => n.nodeType === 1 && n.localName === name && n.namespaceURI === W)
const first = (el, name, ns = W) => el.getElementsByTagNameNS(ns, name)[0] || null

function makeRun(doc, text, { italic = false } = {}) {
  const r = doc.createElementNS(W, 'w:r')
  if (italic) {
    const pr = doc.createElementNS(W, 'w:rPr')
    pr.appendChild(doc.createElementNS(W, 'w:i'))
    r.appendChild(pr)
  }
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (i > 0) r.appendChild(doc.createElementNS(W, 'w:br'))
    const t = doc.createElementNS(W, 'w:t')
    t.setAttributeNS(XML_SPACE, 'xml:space', 'preserve')
    t.appendChild(doc.createTextNode(line))
    r.appendChild(t)
  })
  return r
}

function setCheckbox(sdt, checked) {
  if (!checked) return
  const cb = first(sdt, 'checked', W14)
  if (cb) cb.setAttributeNS(W14, 'w14:val', '1')
  const t = first(first(sdt, 'sdtContent') || sdt, 't')
  if (t) t.textContent = '☒'
}

function setText(doc, sdt, text) {
  if (!text || !String(text).trim()) return
  const pr = first(sdt, 'sdtPr')
  const ph = pr && first(pr, 'showingPlcHdr')
  if (ph) ph.parentNode.removeChild(ph)
  const content = first(sdt, 'sdtContent')
  const paras = kids(content, 'p')
  if (paras.length) {
    const p = paras[0]
    Array.from(p.childNodes).forEach((n) => { if (!(n.localName === 'pPr' && n.namespaceURI === W)) p.removeChild(n) })
    p.appendChild(makeRun(doc, text))
    paras.slice(1).forEach((x) => content.removeChild(x))
  } else {
    Array.from(content.childNodes).forEach((n) => content.removeChild(n))
    content.appendChild(makeRun(doc, text))
  }
}

const norm = (s) => s.replace(/\s+/g, ' ').trim()
const paraText = (p) => Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join('')

// Adds a typed answer after a label such as "Mentor Coach Email:".
function fillLabeled(doc, paragraphs, label, value, opts) {
  if (!value || !String(value).trim()) return
  const target = norm(label).toLowerCase()
  const p = paragraphs.find((x) => norm(paraText(x)).toLowerCase() === target)
  if (!p) throw new Error(`Could not find "${label}" in the form template.`)
  const run = makeRun(doc, ' ' + value, opts)
  // The first line of the form is an old-style text field: the answer goes just before its "end" marker.
  const ends = Array.from(p.getElementsByTagNameNS(W, 'fldChar')).filter((f) => f.getAttributeNS(W, 'fldCharType') === 'end')
  if (ends.length) {
    const endRun = ends[0].parentNode
    endRun.parentNode.insertBefore(run, endRun)
  } else {
    p.appendChild(run)
  }
}

// Writes into a table cell (first paragraph), keeping the cell's formatting.
function fillCell(doc, cell, text) {
  if (!text || !String(text).trim()) return
  const p = kids(cell, 'p')[0]
  if (!p) return
  p.appendChild(makeRun(doc, text))
}

/**
 * review: the on-screen answers (see crfSpec.emptyReview)
 * templateBytes: the ICF .docx as an ArrayBuffer
 * Returns a Blob of the completed .docx
 */
export async function fillCompetencyReview(review, templateBytes) {
  const zip = await JSZip.loadAsync(templateBytes)
  const xml = await zip.file('word/document.xml').async('string')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The form template could not be read.')

  const sdts = Array.from(doc.getElementsByTagNameNS(W, 'sdt'))
  if (sdts.length !== EXPECTED_CONTROLS) throw new Error(`The form template has changed (found ${sdts.length} fields, expected ${EXPECTED_CONTROLS}).`)
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W, 'p'))
  const tables = Array.from(doc.getElementsByTagNameNS(W, 'tbl'))

  const a = review.admin
  fillLabeled(doc, paragraphs, 'Mentor Coach Name:', a.name)
  fillLabeled(doc, paragraphs, 'Mentor Coach Email:', a.email)
  fillLabeled(doc, paragraphs, 'Mentor Coach Client Name:', a.clientName)
  fillLabeled(doc, paragraphs, 'Mentor Coach Client Email:', a.clientEmail)
  fillLabeled(doc, paragraphs, 'Date of Competency Skills Review Feedback Session with the Client:', a.feedbackDate)
  const li = LEVELS.indexOf(review.level)
  if (li >= 0) setCheckbox(sdts[SDT.level + li], true)

  // Hours table (first table, second row) and the two numbered totals
  const hoursRow = tables[0] && kids(tables[0], 'tr')[1]
  if (!hoursRow) throw new Error('Could not find the hours table in the form template.')
  const hc = kids(hoursRow, 'tc')
  fillCell(doc, hc[0], review.individualHours)
  fillCell(doc, hc[1], review.groupHours)
  const total = totalHours(review)
  fillCell(doc, hc[2], total)
  // Item 7 ("Total hours with the client") is the table's third column, so the total goes there only.
  fillLabeled(doc, paragraphs, 'Total observed coaching sessions reviewed individually with the client:', review.observedSessions)

  review.selfReview.forEach((b, i) => setCheckbox(sdts[SDT.selfReview + i], b))

  // Session log (second table): row 0 is the header and row 1 is ICF's example
  const logRows = tables[1] ? kids(tables[1], 'tr').slice(2, 2 + SESSION_ROWS) : []
  if (!logRows.length) throw new Error('Could not find the session log in the form template.')
  review.sessions.slice(0, logRows.length).forEach((s, i) => {
    const cells = kids(logRows[i], 'tc')
    fillCell(doc, cells[0], s.date || s.modality || s.duration ? `Session ${i + 1}` : '')
    fillCell(doc, cells[1], s.date)
    fillCell(doc, cells[2], s.modality)
    fillCell(doc, cells[3], s.duration)
  })

  // Competency 1
  setCheckbox(sdts[SDT.c1], review.c1 === 'yes')
  setCheckbox(sdts[SDT.c1 + 1], review.c1 === 'no')
  setText(doc, sdts[SDT.c1Notes], review.c1Notes)

  // Competencies 3 to 8
  const map = competencyControls()
  COMPETENCIES.forEach((c) => {
    map[c.n].statements.forEach((s) => {
      setCheckbox(sdts[s.at], review.statements[s.id] === 'demonstrated')
      setCheckbox(sdts[s.at + 1], review.statements[s.id] === 'not_yet')
    })
    const met = review.competencyMet[c.n]
    setCheckbox(sdts[map[c.n].met], met === 'yes')
    setCheckbox(sdts[map[c.n].met + 1], met === 'no')
  })

  // Strengths (first six pairs) and development areas (next six pairs)
  ;[...review.strengths, ...review.development].forEach((f, k) => {
    setText(doc, sdts[SDT.feedback + k * 2], f.statement)
    setText(doc, sdts[SDT.feedback + k * 2 + 1], f.comments)
  })

  setCheckbox(sdts[SDT.overall], review.overall === 'demonstrated')
  setCheckbox(sdts[SDT.overall + 1], review.overall === 'not_yet')
  setCheckbox(sdts[SDT.reviewed], review.reviewed)

  fillLabeled(doc, paragraphs, 'Mentor Coach’s Printed Name:', review.printedName)
  fillLabeled(doc, paragraphs, 'Mentor Coach’s Signature:', review.signature, { italic: true })
  fillLabeled(doc, paragraphs, 'Date Signed:', review.dateSigned)

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc))
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })
}

const safe = (s) => String(s || '').replace(/[^\w\- ]+/g, '').trim()

/** Downloads the filled form in the browser. */
export async function downloadCompetencyReview(review) {
  const tpl = await fetch('/templates/icf-competency-review-form-acc.docx')
  if (!tpl.ok) throw new Error('Could not load the ICF form template.')
  const blob = await fillCompetencyReview(review, await tpl.arrayBuffer())
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${['Competency Review Form', safe(review.admin?.clientName)].filter(Boolean).join(' - ')}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
}
