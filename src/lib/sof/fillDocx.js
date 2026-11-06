// Fills the ORIGINAL ICF Session Observation Form (a Word file) with the coach's
// answers, so the download looks exactly like the form ICF publishes.
//
// A .docx is a zip file; the form's content is in word/document.xml. The form
// uses Word "content controls" (check boxes and text boxes). We find them in
// document order and set their values. Everything else (fonts, layout, headers)
// stays as ICF made it.

import JSZip from 'jszip'
import { BEHAVIORS, RATINGS, LEVELS, evidenceText } from './formSpec'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml'
const XML_SPACE = 'http://www.w3.org/XML/1998/namespace'

// Position of each control inside the template (document order).
const SDT = {
  level: 0, // ACC, PCC, MCC
  selfReview: 3, // three boxes
  q1: 6, // Observed, Not Observed (q2 follows at 8, 9)
  comments: 11, // Competency 1 comments (the inner box)
  feedback: 127, // 12 pairs: statement, comments
}
// The first six behaviors have 5 rating boxes + 1 evidence box each, starting at 12.
// A4.3 (index 6) is different in ICF's file: its rating boxes are plain symbols and
// only its evidence box is a control (48). The rest start again at 49.
function behaviorControls(i) {
  if (i < 6) return { rating: 12 + i * 6, evidence: 17 + i * 6 }
  if (i === 6) return { rating: null, evidence: 48 }
  const base = 49 + (i - 7) * 6
  return { rating: base, evidence: base + 5 }
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
  if (!p) return
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

/**
 * form: the on-screen answers (see formSpec.emptyForm)
 * templateBytes: the ICF .docx as an ArrayBuffer
 * Returns a Blob of the completed .docx
 */
export async function fillObservationForm(form, templateBytes) {
  const zip = await JSZip.loadAsync(templateBytes)
  const xml = await zip.file('word/document.xml').async('string')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The form template could not be read.')

  const sdts = Array.from(doc.getElementsByTagNameNS(W, 'sdt'))
  if (sdts.length !== 151) throw new Error(`The form template has changed (found ${sdts.length} fields, expected 151).`)
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W, 'p'))

  // Administrative information
  const a = form.admin
  fillLabeled(doc, paragraphs, 'Mentor Coach Name:', a.name)
  fillLabeled(doc, paragraphs, 'Mentor Coach Email:', a.email)
  fillLabeled(doc, paragraphs, 'Mentor Coach Client Name:', a.clientName)
  fillLabeled(doc, paragraphs, 'Mentor Coach Client Email:', a.clientEmail)
  fillLabeled(doc, paragraphs, 'Date of Client’s Coaching Session or other Session Identification:', a.clientSession)
  fillLabeled(doc, paragraphs, 'Date of Mentor Coaching Session:', a.mentorSession)
  const li = LEVELS.indexOf(form.level)
  if (li >= 0) setCheckbox(sdts[SDT.level + li], true)

  // Self-review checklist
  form.selfReview.forEach((b, i) => setCheckbox(sdts[SDT.selfReview + i], b))

  // Competency 1 qualifiers and comments
  setCheckbox(sdts[SDT.q1], form.q.q1 === 'observed')
  setCheckbox(sdts[SDT.q1 + 1], form.q.q1 === 'not_observed')
  setCheckbox(sdts[SDT.q1 + 2], form.q.q2 === 'observed')
  setCheckbox(sdts[SDT.q1 + 3], form.q.q2 === 'not_observed')
  setText(doc, sdts[SDT.comments], form.qComments)

  // Behaviors
  BEHAVIORS.forEach((b, i) => {
    const c = behaviorControls(i)
    const ri = RATINGS.findIndex((r) => r.id === form.ratings[b.id])
    if (ri >= 0) {
      if (c.rating !== null) {
        setCheckbox(sdts[c.rating + ri], true)
      } else {
        // A4.3: the five rating symbols are ordinary text in the paragraph after the behavior.
        const at = paragraphs.findIndex((p) => norm(paraText(p)).startsWith(b.id + ' '))
        const rp = paragraphs[at + 1]
        const glyphs = Array.from(rp.getElementsByTagNameNS(W, 't')).filter((t) => t.textContent === '☐')
        if (glyphs.length === 5 && glyphs[ri]) glyphs[ri].textContent = '☒'
        else throw new Error('Could not find the rating boxes for ' + b.id)
      }
    }
    setText(doc, sdts[c.evidence], evidenceText(form, b.id))
  })

  // Strengths (first six pairs) and development areas (next six pairs)
  ;[...form.strengths, ...form.development].forEach((f, k) => {
    setText(doc, sdts[SDT.feedback + k * 2], f.statement)
    setText(doc, sdts[SDT.feedback + k * 2 + 1], f.comments)
  })

  // Signature block (typed names count as a digital signature)
  fillLabeled(doc, paragraphs, 'Mentor Coach’s Printed Name:', form.printedName)
  fillLabeled(doc, paragraphs, 'Mentor Coach’s Signature:', form.signature, { italic: true })
  fillLabeled(doc, paragraphs, 'Date Signed:', form.dateSigned)

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc))
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })
}
