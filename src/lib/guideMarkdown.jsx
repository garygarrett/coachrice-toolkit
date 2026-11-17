// A small, safe formatter for the FAQ / Guide. Admins type plain text with a few simple marks:
//   ## Heading        ### Smaller heading
//   - bullet          1. numbered step
//   ![caption](/guide/picture.png)       **bold**       [link text](https://example.com)
// Nothing here uses innerHTML, and links/images only accept http(s), mailto, or a path on this site.

const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/))/i
const safeUrl = (u) => (SAFE_URL.test(String(u || '').trim()) ? String(u).trim() : '')

export function parseGuide(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const blocks = []
  let para = []
  let list = null
  const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = [] } }
  const flushList = () => { if (list) { blocks.push(list); list = null } }
  for (const raw of lines) {
    const line = raw.trim()
    let m
    if (!line) { flushPara(); flushList(); continue }
    if ((m = line.match(/^###\s+(.+)$/))) { flushPara(); flushList(); blocks.push({ type: 'h3', text: m[1] }); continue }
    if ((m = line.match(/^##\s+(.+)$/))) { flushPara(); flushList(); blocks.push({ type: 'h2', text: m[1] }); continue }
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { flushPara(); flushList(); blocks.push({ type: 'img', alt: m[1], src: safeUrl(m[2]) }); continue }
    if ((m = line.match(/^[-*]\s+(.+)$/))) {
      flushPara()
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] } }
      list.items.push(m[1]); continue
    }
    if ((m = line.match(/^\d+[.)]\s+(.+)$/))) {
      flushPara()
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] } }
      list.items.push(m[1]); continue
    }
    flushList()
    para.push(line)
  }
  flushPara(); flushList()
  return blocks
}

// Splits one line of text into plain, bold, and link pieces.
function inline(text) {
  const out = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ t: 'bold', v: m[1] })
    else out.push({ t: 'link', v: m[2], href: safeUrl(m[3]) })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) })
  return out
}

const NAVY = '#00205B'

// ---- On screen ----
export function GuideBody({ text, font = 'Montserrat, sans-serif' }) {
  const blocks = parseGuide(text)
  const spans = (s) => inline(s).map((p, i) =>
    p.t === 'bold' ? <strong key={i}>{p.v}</strong>
      : p.t === 'link' ? (p.href ? <a key={i} href={p.href} target="_blank" rel="noreferrer" style={{ color: NAVY, fontWeight: 600 }}>{p.v}</a> : <span key={i}>{p.v}</span>)
        : <span key={i}>{p.v}</span>)
  return (
    <div style={{ fontFamily: font, fontSize: 14, lineHeight: 1.65, color: '#0f1c3a' }}>
      {blocks.map((b, i) => {
        if (b.type === 'h2') return <h3 key={i} style={{ fontSize: 16, color: NAVY, margin: '18px 0 6px' }}>{b.text}</h3>
        if (b.type === 'h3') return <h4 key={i} style={{ fontSize: 14, color: NAVY, margin: '14px 0 4px' }}>{b.text}</h4>
        if (b.type === 'ul') return <ul key={i} style={{ margin: '6px 0 10px', paddingLeft: 22 }}>{b.items.map((x, j) => <li key={j} style={{ marginBottom: 3 }}>{spans(x)}</li>)}</ul>
        if (b.type === 'ol') return <ol key={i} style={{ margin: '6px 0 10px', paddingLeft: 22 }}>{b.items.map((x, j) => <li key={j} style={{ marginBottom: 3 }}>{spans(x)}</li>)}</ol>
        if (b.type === 'img') return b.src ? (
          <figure key={i} style={{ margin: '12px 0' }}>
            <img src={b.src} alt={b.alt} style={{ width: '100%', maxWidth: 820, border: '1px solid #e2e6ec', borderRadius: 8, display: 'block' }} />
            {b.alt && <figcaption style={{ fontSize: 12, color: '#6b7a99', marginTop: 4 }}>{b.alt}</figcaption>}
          </figure>
        ) : null
        return <p key={i} style={{ margin: '0 0 10px' }}>{spans(b.text)}</p>
      })}
    </div>
  )
}

// ---- For printing / saving as PDF ----
export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function guideToHtml(text) {
  const spans = (s) => inline(s).map((p) =>
    p.t === 'bold' ? `<strong>${escapeHtml(p.v)}</strong>`
      : p.t === 'link' ? (p.href ? `<a href="${escapeHtml(p.href)}">${escapeHtml(p.v)}</a>` : escapeHtml(p.v))
        : escapeHtml(p.v)).join('')
  return parseGuide(text).map((b) => {
    if (b.type === 'h2') return `<h3>${escapeHtml(b.text)}</h3>`
    if (b.type === 'h3') return `<h4>${escapeHtml(b.text)}</h4>`
    if (b.type === 'ul') return `<ul>${b.items.map((x) => `<li>${spans(x)}</li>`).join('')}</ul>`
    if (b.type === 'ol') return `<ol>${b.items.map((x) => `<li>${spans(x)}</li>`).join('')}</ol>`
    if (b.type === 'img') return b.src ? `<figure><img src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt)}">${b.alt ? `<figcaption>${escapeHtml(b.alt)}</figcaption>` : ''}</figure>` : ''
    return `<p>${spans(b.text)}</p>`
  }).join('\n')
}

export const CONTACT_LINE = 'For any questions, email CoachRICE@rice.edu'

// A complete, print-ready page (cover + one block per section). Used by "Print / Save as PDF" and to make the PDF file.
export function guideDocumentHtml(sections, { title = 'CoachRICE Toolkit: FAQ / Guide', subtitle = '', origin = '', extraCss = '' } = {}) {
  const fix = (html) => (origin ? html.replace(/src="\/(?!\/)/g, `src="${origin}/`) : html)
  const toc = sections.map((s, i) => `<li>${escapeHtml(s.title)}</li>`).join('')
  const body = sections.map((s, i) => `
    <section>
      <h2><span>${i + 1}</span>${escapeHtml(s.title)}</h2>
      ${fix(guideToHtml(s.body))}
    </section>`).join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: Letter; margin: 0.7in 0.7in 0.8in; }
  * { box-sizing: border-box; }
  body { font-family: Montserrat, Arial, sans-serif; color: #0f1c3a; font-size: 11pt; line-height: 1.55; margin: 0; }
  .cover { background: ${NAVY}; color: #fff; padding: 56px 44px 48px; border-radius: 10px; margin-bottom: 26px; }
  .cover .eyebrow { color: #69cce6; font-size: 9pt; letter-spacing: 0.14em; font-weight: 700; text-transform: uppercase; }
  .cover h1 { font-size: 26pt; line-height: 1.15; margin: 10px 0 8px; }
  .cover p { color: #cfd8ea; margin: 0; font-size: 11pt; }
  .toc { border: 1px solid #e2e6ec; border-radius: 8px; padding: 14px 22px; margin-bottom: 24px; }
  .toc h3 { margin: 0 0 6px; color: ${NAVY}; font-size: 12pt; }
  .toc ol { margin: 0; padding-left: 20px; columns: 2; font-size: 10pt; }
  section { margin-bottom: 22px; }
  section h2 { font-size: 15pt; color: ${NAVY}; margin: 0 0 8px; padding-bottom: 6px; border-bottom: 2px solid #69cce6; break-after: avoid; }
  section h2 span { display: inline-block; background: ${NAVY}; color: #fff; border-radius: 50%; width: 26px; height: 26px; line-height: 26px; text-align: center; font-size: 11pt; margin-right: 10px; }
  h3 { font-size: 12pt; color: ${NAVY}; margin: 14px 0 4px; break-after: avoid; }
  h4 { font-size: 11pt; color: ${NAVY}; margin: 10px 0 3px; break-after: avoid; }
  p { margin: 0 0 8px; } ul, ol { margin: 4px 0 10px; padding-left: 22px; } li { margin-bottom: 3px; }
  figure { margin: 10px 0 14px; break-inside: avoid; } figure img { width: 100%; border: 1px solid #d5dbe6; border-radius: 6px; display: block; }
  figcaption { font-size: 8.5pt; color: #6b7a99; margin-top: 4px; }
  a { color: ${NAVY}; font-weight: 600; }
  .contact { margin-top: 28px; padding: 14px 18px; border-radius: 8px; background: #eef7fb; border-left: 5px solid #69cce6; font-weight: 600; color: ${NAVY}; break-inside: avoid; }
${extraCss}
</style></head><body>
  <div class="cover"><div class="eyebrow">Doerr Institute for New Leaders · CoachRICE</div><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
  <div class="toc"><h3>In this guide</h3><ol>${toc}</ol></div>
  ${body}
  <div class="contact">${CONTACT_LINE.replace('CoachRICE@rice.edu', '<a href="mailto:CoachRICE@rice.edu">CoachRICE@rice.edu</a>')}</div>
</body></html>`
}
