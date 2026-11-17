import { useRef, useState } from 'react'
import { GuideBody } from '../lib/guideMarkdown'
import { prepareImage } from '../lib/resizeImage'

const C = { navy: '#00205B', teal: '#69cce6', border: '#e2e6ec', muted: '#6b7a99', orange: '#ff8200' }
const tbtn = { fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 13, minWidth: 34, height: 32, padding: '0 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: C.navy, cursor: 'pointer' }

// A writing box with a toolbar (bold, headings, lists, links, pictures) and a live preview beside it.
// Pictures can be added with the Picture button, by pasting, or by dragging a file onto the box.
// `uploadImage(file)` must return the address of the stored picture.
export default function GuideEditor({ value, onChange, uploadImage, font = 'Montserrat, sans-serif' }) {
  const ta = useRef(null)
  const fileInput = useRef(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [drag, setDrag] = useState(false)

  const edit = (fn) => {
    const el = ta.current
    const start = el.selectionStart, end = el.selectionEnd
    const { text, selStart, selEnd } = fn(value, start, end)
    onChange(text)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(selStart, selEnd) })
  }
  const wrap = (mark, placeholder) => edit((v, a, b) => {
    const sel = v.slice(a, b) || placeholder
    return { text: v.slice(0, a) + mark + sel + mark + v.slice(b), selStart: a + mark.length, selEnd: a + mark.length + sel.length }
  })
  // Puts a prefix at the start of every selected line (headings, bullets, numbers).
  const prefixLines = (prefix, numbered = false) => edit((v, a, b) => {
    const lineStart = v.lastIndexOf('\n', a - 1) + 1
    const nl = v.indexOf('\n', b); const lineEnd = nl === -1 ? v.length : nl
    const block = v.slice(lineStart, lineEnd) || 'Text'
    const out = block.split('\n').map((l, i) => (numbered ? `${i + 1}. ` : prefix) + l.replace(/^(#{2,3}\s+|[-*]\s+|\d+[.)]\s+)/, '')).join('\n')
    return { text: v.slice(0, lineStart) + out + v.slice(lineEnd), selStart: lineStart, selEnd: lineStart + out.length }
  })
  const link = () => {
    const url = window.prompt('Web address for the link (for example https://rice.edu):')
    if (!url) return
    edit((v, a, b) => {
      const sel = v.slice(a, b) || 'link text'
      const md = `[${sel}](${url.trim()})`
      return { text: v.slice(0, a) + md + v.slice(b), selStart: a, selEnd: a + md.length }
    })
  }
  const insertImage = async (file) => {
    setErr(''); setBusy(true)
    try {
      const caption = (window.prompt('Caption for this picture (optional, shown under it):', '') || '').replace(/[\[\]\n]/g, ' ').trim()
      const url = await uploadImage(await prepareImage(file))
      edit((v, a, b) => {
        const md = `${a > 0 && v[a - 1] !== '\n' ? '\n\n' : ''}![${caption}](${url})\n\n`
        return { text: v.slice(0, a) + md + v.slice(b), selStart: a + md.length, selEnd: a + md.length }
      })
    } catch (e) { setErr(e.message || 'The picture could not be added.') } finally { setBusy(false) }
  }
  const imageFrom = (files) => [...(files || [])].find((f) => f.type.startsWith('image/'))
  const onPaste = (e) => { const f = imageFrom(e.clipboardData?.files); if (f) { e.preventDefault(); insertImage(f) } }
  const onDrop = (e) => { setDrag(false); const f = imageFrom(e.dataTransfer?.files); if (f) { e.preventDefault(); insertImage(f) } }

  return (
    <div>
      <div role="toolbar" aria-label="Formatting" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 8px' }}>
        <button type="button" style={tbtn} title="Bold" aria-label="Bold" onClick={() => wrap('**', 'bold text')}><b>B</b></button>
        <button type="button" style={tbtn} title="Heading" aria-label="Heading" onClick={() => prefixLines('## ')}>Heading</button>
        <button type="button" style={tbtn} title="Smaller heading" aria-label="Smaller heading" onClick={() => prefixLines('### ')}>Subheading</button>
        <button type="button" style={tbtn} title="Bulleted list" aria-label="Bulleted list" onClick={() => prefixLines('- ')}>• List</button>
        <button type="button" style={tbtn} title="Numbered steps" aria-label="Numbered steps" onClick={() => prefixLines('', true)}>1. Steps</button>
        <button type="button" style={tbtn} title="Link" aria-label="Link" onClick={link}>Link</button>
        <button type="button" style={{ ...tbtn, background: C.navy, color: '#fff', borderColor: C.navy }} disabled={busy} title="Add a picture" aria-label="Add a picture" onClick={() => fileInput.current?.click()}>{busy ? 'Uploading…' : '🖼 Picture'}</button>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-testid="guide-image-input"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) insertImage(f) }} />
      </div>
      {err && <div role="alert" style={{ background: '#fff4e5', border: `1px solid ${C.orange}`, color: '#7a3d00', padding: '8px 12px', borderRadius: 8, marginBottom: 8, fontSize: 13 }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <textarea ref={ta} id="g-body" aria-label="Section text" value={value} onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
          style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, lineHeight: 1.5, padding: 12, borderRadius: 8, border: `1.5px ${drag ? 'dashed' : 'solid'} ${drag ? C.teal : C.border}`, minHeight: 360, width: '100%', boxSizing: 'border-box', resize: 'vertical', background: drag ? '#f2fafd' : '#fff' }} />
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, minHeight: 360, background: '#fcfdff', overflow: 'auto', maxHeight: 520 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Preview</div>
          {value.trim() ? <GuideBody text={value} font={font} /> : <div style={{ color: C.muted, fontSize: 13 }}>What you type appears here.</div>}
        </div>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted }}>
        Tip: you can also paste a screenshot straight into the box, or drag a picture onto it. Leave a blank line between paragraphs.
      </p>
    </div>
  )
}
