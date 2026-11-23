import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { authFetch } from '../lib/authFetch'
import { invalidateGuide } from '../lib/guideAvailability'
import { GuideBody, guideDocumentHtml, CONTACT_LINE } from '../lib/guideMarkdown'
import { STARTER_SECTIONS } from '../lib/guideDefaults'
import GuideEditor from '../components/GuideEditor'

const font = 'Montserrat, sans-serif'
const C = { navy: '#00205B', teal: '#69cce6', gray: '#7C7E7F', orange: '#ff8200', lime: '#c9d647', border: '#e2e6ec', muted: '#6b7a99' }
const AUDIENCES = [
  { id: 'participant', label: 'Participants' },
  { id: 'mentor', label: 'Mentor coaches' },
  { id: 'tool_admin', label: 'Tool admins' },
]
const label = (id) => AUDIENCES.find((a) => a.id === id)?.label || id

const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: 24, marginBottom: 16 }
const btn = (primary) => ({ fontFamily: font, fontWeight: 700, fontSize: 13, padding: '9px 16px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${C.navy}`, background: primary ? C.navy : '#fff', color: primary ? '#fff' : C.navy })
const input = { fontFamily: font, fontSize: 14, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, width: '100%', boxSizing: 'border-box' }

export default function FAQGuide() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'
  const [sections, setSections] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null) // the section open in the editor ({ id?, title, body, audiences })
  const [busy, setBusy] = useState(false)

  async function call(action, body) {
    const res = await authFetch(`/api/user-actions?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.')
    return json
  }

  async function load() {
    try {
      setSections((await call('guide-list')).sections || [])
      setError('')
    } catch (e) { setError(e.message); setSections([]) }
  }
  useEffect(() => { load() }, [])

  const changed = async (msg) => { invalidateGuide(); setNotice(msg || ''); await load() }

  async function save() {
    if (!draft.title.trim()) { setError('Please give the section a title.'); return }
    setBusy(true); setError('')
    try {
      await call('guide-save', draft)
      setDraft(null)
      await changed('Saved.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function remove(s) {
    if (!window.confirm(`Delete the section "${s.title}"? This cannot be undone.`)) return
    try { await call('guide-delete', { id: s.id }); if (draft?.id === s.id) setDraft(null); await changed('Section deleted.') } catch (e) { setError(e.message) }
  }
  async function move(i, dir) {
    const next = [...sections]; const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setSections(next)
    try { await call('guide-reorder', { ids: next.map((s) => s.id) }); invalidateGuide() } catch (e) { setError(e.message); load() }
  }
  async function seed() {
    setBusy(true); setError('')
    try { await call('guide-seed', { sections: STARTER_SECTIONS }); await changed('Starter sections added. Change anything you like.') } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  // Opens a clean copy of the guide in a new window and starts the browser's print dialog (choose "Save as PDF").
  function printGuide() {
    const w = window.open('', '_blank')
    if (!w) { setError('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return }
    const html = guideDocumentHtml(sections, { subtitle: 'Step-by-step help for using the toolkit', origin: window.location.origin })
    w.document.open(); w.document.write(html); w.document.close()
    const go = () => { try { w.focus(); w.print() } catch { /* the person can print from the window */ } }
    const imgs = [...w.document.images]
    if (!imgs.length) { setTimeout(go, 400); return }
    let left = imgs.length
    const done = () => { left -= 1; if (left <= 0) setTimeout(go, 300) }
    imgs.forEach((im) => (im.complete ? done() : (im.onload = im.onerror = done)))
  }

  const toc = useMemo(() => (sections || []).map((s) => ({ id: s.id, title: s.title })), [sections])
  const scrollTo = (id) => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const toggleAudience = (id) => setDraft((d) => ({ ...d, audiences: d.audiences.includes(id) ? d.audiences.filter((a) => a !== id) : [...d.audiences, id] }))

  return (
    <Layout active="guide" pageTitle="FAQ / Guide">
      <div style={{ fontFamily: font, maxWidth: editing ? 960 : 1180, margin: '0 auto', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ margin: 0, fontSize: 26, color: C.navy }}>FAQ / Guide</h1>
            <p style={{ margin: '6px 0 0', color: C.muted, fontSize: 14 }}>Step-by-step help for using the CoachRICE Toolkit.</p>
          </div>
          {['mentor', 'admin_tools', 'admin'].includes(profile?.role) && !editing && <button style={btn(false)} onClick={() => navigate('/tools/session-observation?tour=home')}>Take a guided tour</button>}
          {sections && sections.length > 0 && !editing && <button style={btn(false)} onClick={printGuide}>Print / Save as PDF</button>}
          {isAdmin && <button style={btn(!editing)} onClick={() => { setEditing((v) => !v); setDraft(null); setNotice(''); setError('') }}>{editing ? 'Done editing' : 'Edit guide'}</button>}
        </div>

        {notice && <div role="status" style={{ background: '#eef7fb', border: `1px solid ${C.teal}`, color: C.navy, padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{notice}</div>}
        {error && <div role="alert" style={{ background: '#fff4e5', border: `1px solid ${C.orange}`, color: '#7a3d00', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}

        {sections === null && <p style={{ color: C.muted }}>Loading…</p>}

        {sections && sections.length === 0 && (
          <div style={card}>
            {isAdmin ? (
              <>
                <h2 style={{ margin: '0 0 8px', fontSize: 18, color: C.navy }}>No sections yet</h2>
                <p style={{ color: C.muted, fontSize: 14, margin: '0 0 14px' }}>Add a section yourself, or start from the ready-made mentor coach guide (screenshots included) and edit it.</p>
                <button style={btn(true)} disabled={busy} onClick={seed}>{busy ? 'Adding…' : 'Load the starter mentor coach guide'}</button>{' '}
                <button style={btn(false)} onClick={() => { setEditing(true); setDraft({ title: '', body: '', audiences: ['mentor'] }) }}>Write a new section</button>
              </>
            ) : <p style={{ margin: 0, color: C.muted }}>There is nothing here yet.</p>}
          </div>
        )}

        {/* ---- Reading view ---- */}
        {sections && sections.length > 0 && !editing && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <nav aria-label="In this guide" style={{ flex: '0 0 230px', position: 'sticky', top: 16, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 10px' }}>
              <div style={{ fontWeight: 700, color: C.navy, margin: '0 8px 8px', fontSize: 13, letterSpacing: '0.03em', textTransform: 'uppercase' }}>In this guide</div>
              {toc.map((t, i) => (
                <a key={t.id} href={`#guide-${t.id}`} onClick={(e) => { e.preventDefault(); scrollTo(t.id) }}
                  style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '7px 8px', borderRadius: 6, color: C.navy, fontWeight: 600, fontSize: 13, lineHeight: 1.35, textDecoration: 'none' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#eef6ff' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <span style={{ color: C.muted, minWidth: 16 }}>{i + 1}.</span><span>{t.title}</span>
                </a>
              ))}
            </nav>
            <div style={{ flex: '1 1 480px', minWidth: 0 }}>
            {sections.map((s, i) => (
              <section key={s.id} id={`guide-${s.id}`} style={card}>
                <h2 style={{ margin: '0 0 10px', fontSize: 19, color: C.navy, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: C.navy, color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{i + 1}</span>
                  {s.title}
                  {isAdmin && (s.audiences || []).length === 0 && <span style={{ fontSize: 11, background: '#fff4e5', color: '#7a3d00', border: `1px solid ${C.orange}`, borderRadius: 999, padding: '2px 8px' }}>Hidden from everyone</span>}
                  {isAdmin && (s.audiences || []).map((a) => <span key={a} style={{ fontSize: 11, fontWeight: 600, background: '#eef7fb', color: C.navy, borderRadius: 999, padding: '2px 8px' }}>{label(a)}</span>)}
                </h2>
                <GuideBody text={s.body} font={font} />
              </section>
            ))}
            </div>
          </div>
        )}

        {/* ---- Editing view (full admins) ---- */}
        {isAdmin && editing && sections && (
          <>
            {sections.length > 0 && (
              <div style={card}>
                <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4, fontSize: 15 }}>Sections</div>
                <p style={{ margin: '0 0 12px', color: C.muted, fontSize: 13 }}>The order here is the order everyone sees. Each person only sees sections marked for their kind of account. If someone has no section marked for them, the FAQ / Guide link does not appear for them.</p>
                {sections.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{i + 1}. {s.title}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{(s.audiences || []).length ? `Visible to: ${s.audiences.map(label).join(', ')}` : 'Visible to: nobody (only you)'}</div>
                    </div>
                    <button style={{ ...btn(false), padding: '6px 10px' }} aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button style={{ ...btn(false), padding: '6px 10px' }} aria-label={`Move ${s.title} down`} disabled={i === sections.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button style={{ ...btn(false), padding: '6px 12px' }} onClick={() => { setDraft({ id: s.id, title: s.title, body: s.body, audiences: s.audiences || [] }); setNotice(''); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) }}>Edit</button>
                    <button style={{ ...btn(false), padding: '6px 12px', color: '#a03030', borderColor: '#a03030' }} onClick={() => remove(s)}>Delete</button>
                  </div>
                ))}
              </div>
            )}

            {!draft && <button style={btn(true)} onClick={() => { setDraft({ title: '', body: '', audiences: ['mentor'] }); setNotice('') }}>+ Add a section</button>}

            {draft && (
              <div style={card}>
                <div style={{ fontWeight: 700, color: C.navy, marginBottom: 12, fontSize: 16 }}>{draft.id ? 'Edit section' : 'New section'}</div>
                <label htmlFor="g-title" style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>Title</label>
                <input id="g-title" style={{ ...input, margin: '4px 0 14px' }} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} />
                <label htmlFor="g-body" style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>Text</label>
                <GuideEditor value={draft.body} onChange={(v) => setDraft((d) => ({ ...d, body: v }))} uploadImage={async (img) => (await call('guide-upload-image', img)).url} font={font} />
                <div style={{ height: 14 }} />
                <fieldset style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', margin: '0 0 14px' }}>
                  <legend style={{ fontWeight: 700, fontSize: 13, color: C.navy, padding: '0 6px' }}>Who can see this section?</legend>
                  {AUDIENCES.map((a) => (
                    <label key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 18, fontSize: 14 }}>
                      <input type="checkbox" checked={draft.audiences.includes(a.id)} onChange={() => toggleAudience(a.id)} /> {a.label}
                    </label>
                  ))}
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Full admins always see every section. Tool admins are accounts that use the Internal Assessor and Audio to Transcript tools.</div>
                </fieldset>
                <button style={btn(true)} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save section'}</button>{' '}
                <button style={btn(false)} onClick={() => { setDraft(null); setError('') }}>Cancel</button>
              </div>
            )}
          </>
        )}

        {sections && (sections.length > 0 || editing) && (
          <div style={{ marginTop: 8, padding: '14px 18px', borderRadius: 4, background: '#eef7fb', borderLeft: `5px solid ${C.teal}`, color: C.navy, fontWeight: 600, fontSize: 14 }}>
            For any questions, email <a href="mailto:CoachRICE@rice.edu" style={{ color: C.navy }}>CoachRICE@rice.edu</a>
          </div>
        )}
      </div>
    </Layout>
  )
}
