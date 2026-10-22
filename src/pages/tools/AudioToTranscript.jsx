import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { authFetch } from '../../lib/authFetch'

const C = {
  navy: '#00205B',
  gray: '#7C7E7F',
  white: '#FFFFFF',
  sky: '#69cce6',
  blue: '#78b3e0',
  orange: '#ff8200',
  green: '#c9d647',
  border: '#e2e6ec',
  soft: '#f0f2f5',
}
const font = "'Montserrat', sans-serif"
const MAX_BYTES = 500 * 1024 * 1024 // 500 MB

const DEEPGRAM_URL =
  'https://api.deepgram.com/v1/listen?' +
  new URLSearchParams({
    model: 'nova-3',
    diarize: 'true',
    punctuate: 'true',
    utterances: 'true',
    smart_format: 'true',
    // Tells Deepgram not to use this audio to train its models.
    mip_opt_out: 'true',
  }).toString()

const btn = (primary, disabled) => ({
  fontFamily: font, fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 8,
  border: primary ? 'none' : `1px solid ${C.navy}`,
  background: primary ? C.navy : C.white, color: primary ? C.white : C.navy,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
})
const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }

function stamp(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// Turn Deepgram's answer into a list of speaker turns we can edit.
function buildTurns(result) {
  const utterances = result?.results?.utterances
  let turns = []
  if (Array.isArray(utterances) && utterances.length) {
    for (const u of utterances) {
      const text = (u.transcript || '').trim()
      if (!text) continue
      const dur = Math.max(0, (u.end || 0) - (u.start || 0))
      const last = turns[turns.length - 1]
      if (last && last.speaker === (u.speaker ?? 0)) {
        last.text += ' ' + text
        last.dur += dur
      } else {
        turns.push({ speaker: u.speaker ?? 0, start: u.start || 0, dur, text })
      }
    }
  } else {
    const text = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim()
    if (text) turns = [{ speaker: 0, start: 0, dur: result?.metadata?.duration ?? null, text }]
  }
  return turns.map((t, i) => ({ ...t, id: i + 1 }))
}

export default function AudioToTranscript() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const xhrRef = useRef(null)

  const [stage, setStage] = useState('input') // input | working | edit
  const [file, setFile] = useState(null)
  const [consent, setConsent] = useState(false)
  const [progress, setProgress] = useState({ label: '', pct: 0 })
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [turns, setTurns] = useState([])
  const [names, setNames] = useState({}) // { speakerId: 'Coach' }
  const [duration, setDuration] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const [history, setHistory] = useState([])

  useEffect(() => { loadHistory() }, [])
  useEffect(() => () => xhrRef.current?.abort(), [])

  async function loadHistory() {
    try {
      const res = await authFetch('/api/user-actions?action=audio-list', { method: 'POST' })
      if (res.ok) setHistory((await res.json()).data || [])
    } catch { /* the list is a convenience; ignore */ }
  }

  function pickFile(f) {
    setError('')
    if (!f) return
    const okType = f.type.startsWith('audio/') || f.type.startsWith('video/') || /\.(mp3|m4a|wav|mp4|mov|aac|ogg|flac|webm)$/i.test(f.name)
    if (!okType) { setError('That does not look like an audio or video file. Try MP3, M4A, WAV, or MP4.'); return }
    if (f.size > MAX_BYTES) { setError('That file is over 500 MB. Please compress it or split it into parts.'); return }
    setFile(f)
    setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function transcribe() {
    if (!file || !consent) return
    setError('')
    setStage('working')
    setProgress({ label: 'Preparing a secure connection…', pct: 0 })
    try {
      const tokRes = await authFetch('/api/user-actions?action=audio-token', { method: 'POST' })
      const tok = await tokRes.json().catch(() => ({}))
      if (!tokRes.ok || !tok.token) throw new Error(tok.error || `Could not start (status ${tokRes.status})`)

      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr
        xhr.open('POST', DEEPGRAM_URL)
        xhr.setRequestHeader('Authorization', `Bearer ${tok.token}`)
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setProgress({ label: pct < 100 ? `Uploading audio… ${pct}%` : 'Transcribing. Long recordings can take a few minutes…', pct })
          }
        }
        xhr.upload.onload = () => setProgress({ label: 'Transcribing. Long recordings can take a few minutes…', pct: 100 })
        xhr.onload = () => {
          let body = null
          try { body = JSON.parse(xhr.responseText) } catch { /* handled below */ }
          if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body)
          else reject(new Error(`Deepgram returned status ${xhr.status}. ${(body?.err_msg || body?.message || '').toString().slice(0, 200)}`))
        }
        xhr.onerror = () => reject(new Error('The upload was blocked or lost the connection. Check your internet and try again.'))
        xhr.onabort = () => reject(new Error('Cancelled'))
        xhr.send(file)
      })
      xhrRef.current = null

      const t = buildTurns(result)
      if (!t.length) throw new Error('No speech was found in that recording.')
      const ids = [...new Set(t.map((x) => x.speaker))].sort((a, b) => a - b)
      const initial = {}
      ids.forEach((id, i) => { initial[id] = ids.length > 1 ? `Speaker ${i + 1}` : 'Speaker' })
      setTurns(t)
      setNames(initial)
      setDuration(result?.metadata?.duration ?? null)
      setSaved(false)
      setStage('edit')
    } catch (err) {
      if (err.message !== 'Cancelled') setError(err.message)
      setStage('input')
    }
  }

  function cancelWork() { xhrRef.current?.abort() }

  const speakerIds = [...new Set(turns.map((t) => t.speaker))].sort((a, b) => a - b)
  const nameOf = (id) => (names[id] || '').trim() || `Speaker ${id + 1}`

  function edit(fn) { fn(); setSaved(false) }

  function updateTurn(id, patch) { edit(() => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))) }
  function removeTurn(id) { edit(() => setTurns((ts) => ts.filter((t) => t.id !== id))) }
  function mergeUp(id) {
    edit(() => setTurns((ts) => {
      const i = ts.findIndex((t) => t.id === id)
      if (i <= 0) return ts
      const merged = { ...ts[i - 1], text: `${ts[i - 1].text} ${ts[i].text}`.trim(), dur: (ts[i - 1].dur ?? 0) + (ts[i].dur ?? 0) }
      return [...ts.slice(0, i - 1), merged, ...ts.slice(i + 1)]
    }))
  }
  function swapTwoSpeakers() {
    if (speakerIds.length !== 2) return
    const [a, b] = speakerIds
    edit(() => {
      setNames((n) => ({ ...n, [a]: n[b], [b]: n[a] }))
    })
  }

  // Speaking time and word counts per speaker. Percentages are shares of all
  // speaking time (silence is left out) and of all words.
  function breakdown() {
    const hasTime = turns.length > 0 && turns.every((t) => typeof t.dur === 'number')
    const rows = speakerIds.map((id) => {
      const mine = turns.filter((t) => t.speaker === id)
      const seconds = mine.reduce((n, t) => n + (t.dur || 0), 0)
      const words = mine.reduce((n, t) => n + (t.text.trim() ? t.text.trim().split(/\s+/).length : 0), 0)
      return { id, seconds, words, turns: mine.length }
    })
    const totalSec = rows.reduce((n, r) => n + r.seconds, 0)
    const totalWords = rows.reduce((n, r) => n + r.words, 0)
    return {
      hasTime,
      totalSec,
      rows: rows.map((r) => ({
        ...r,
        timePct: totalSec ? (r.seconds / totalSec) * 100 : 0,
        wordPct: totalWords ? (r.words / totalWords) * 100 : 0,
      })),
    }
  }

  function fullText() {
    return turns.map((t) => `[${stamp(t.start)}] ${nameOf(t.speaker)}: ${t.text.trim()}`).join('\n\n')
  }

  function download() {
    const blob = new Blob([fullText() + '\n'], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'transcript').replace(/[^\w\- ]+/g, '').trim() || 'transcript'}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function copy() {
    try { await navigator.clipboard.writeText(fullText()); flash('Copied to your clipboard.') }
    catch { flash('Could not copy. Use Download instead.') }
  }

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 3500) }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await authFetch('/api/user-actions?action=audio-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Untitled transcript',
          transcriptText: fullText(),
          turns: turns.map(({ speaker, start, dur, text }) => ({ speaker, start, dur, text })),
          speakerNames: names,
          durationSeconds: duration,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `Save failed (status ${res.status})`)
      setSaved(true)
      flash('Saved to your transcripts.')
      loadHistory()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  function sendToScorer() {
    try {
      sessionStorage.setItem('pendingTranscript', fullText())
      sessionStorage.setItem('pendingTranscriptName', title || 'Audio transcript')
    } catch {
      setError('Your browser blocked the handoff. Use Copy, then paste into the Transcript Reviewer.')
      return
    }
    navigate('/tools/transcript')
  }

  async function openSaved(id) {
    setError('')
    try {
      const res = await authFetch('/api/user-actions?action=audio-get', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      })
      const row = await res.json()
      if (!res.ok) throw new Error(row.error || 'Could not open that transcript')
      let t = Array.isArray(row.turns) ? row.turns.map((x, i) => ({ ...x, id: i + 1 })) : []
      if (!t.length) t = [{ id: 1, speaker: 0, start: 0, text: row.transcript_text }]
      setTurns(t)
      setNames(row.speaker_names || { 0: 'Speaker' })
      setTitle(row.title)
      setDuration(row.duration_seconds)
      setSaved(true)
      setStage('edit')
    } catch (err) { setError(err.message) }
  }

  async function deleteSaved(id) {
    if (!window.confirm('Delete this saved transcript?')) return
    const res = await authFetch('/api/user-actions?action=audio-delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    if (res.ok) setHistory((h) => h.filter((x) => x.id !== id))
    else setError('Could not delete that transcript.')
  }

  function startOver() {
    if (stage === 'edit' && !saved && !window.confirm('You have unsaved edits. Start over anyway?')) return
    setStage('input'); setFile(null); setConsent(false); setTurns([]); setTitle(''); setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const bd = breakdown()

  return (
    <Layout active="audio" pageTitle="Audio to Transcript">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 32, fontFamily: font, color: '#0f1c3a' }}>
        <h1 style={{ color: C.navy, fontSize: 24, margin: '0 0 6px' }}>Audio to Transcript</h1>
        <p style={{ color: C.gray, fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
          Upload a recording, name the speakers, fix any mistakes, then export it or send it to the Transcript Reviewer.
        </p>

        {error && (
          <div style={{ ...card, borderColor: C.orange, background: '#fff6ec', padding: 14, fontSize: 13 }}>{error}</div>
        )}
        {notice && (
          <div style={{ ...card, borderColor: C.green, background: '#f7fadc', padding: 14, fontSize: 13 }}>{notice}</div>
        )}

        {stage === 'input' && (
          <>
            <div style={card}>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}
                style={{ border: `2px dashed ${C.blue}`, borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer', background: C.soft }}
              >
                <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>
                  {file ? file.name : 'Click to choose a recording, or drop it here'}
                </div>
                <div style={{ fontSize: 12, color: C.gray }}>
                  {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'MP3, M4A, WAV, MP4 and similar. Up to 500 MB.'}
                </div>
                <input ref={fileRef} type="file" accept="audio/*,video/mp4,video/quicktime,video/webm" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
              </div>

              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, fontSize: 13, lineHeight: 1.5 }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  Everyone in this recording has agreed to have it transcribed by an outside service (Deepgram).
                  The audio goes straight from your browser to Deepgram, is not saved by CoachRICE, and Deepgram is
                  told not to use it to train its models.
                </span>
              </label>

              <div style={{ marginTop: 18 }}>
                <button style={btn(true, !file || !consent)} disabled={!file || !consent} onClick={transcribe}>Transcribe</button>
              </div>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: 15, color: C.navy, margin: '0 0 12px' }}>Your saved transcripts</h2>
              {history.length === 0 && <div style={{ fontSize: 13, color: C.gray }}>Nothing saved yet.</div>}
              {history.map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{h.title}</div>
                    <div style={{ color: C.gray, fontSize: 12 }}>
                      {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {h.duration_seconds ? ` · ${stamp(h.duration_seconds)}` : ''}
                    </div>
                  </div>
                  <button style={btn(false)} onClick={() => openSaved(h.id)}>Open</button>
                  <button style={{ ...btn(false), borderColor: C.orange, color: C.orange }} onClick={() => deleteSaved(h.id)}>Delete</button>
                </div>
              ))}
            </div>
          </>
        )}

        {stage === 'working' && (
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 14 }}>{progress.label}</div>
            <div style={{ height: 10, background: C.soft, borderRadius: 5, overflow: 'hidden', maxWidth: 480, margin: '0 auto 18px' }}>
              <div style={{ height: '100%', width: `${progress.pct}%`, background: C.sky, transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Please keep this tab open.</div>
            <button style={btn(false)} onClick={cancelWork}>Cancel</button>
          </div>
        )}

        {stage === 'edit' && (
          <>
            <div style={card}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Title</label>
              <input
                value={title}
                onChange={(e) => edit(() => setTitle(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box', margin: '6px 0 18px', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: font, fontSize: 14 }}
              />

              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Who is speaking?</div>
              {speakerIds.map((id) => (
                <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <input
                    value={names[id] ?? ''}
                    onChange={(e) => edit(() => setNames((n) => ({ ...n, [id]: e.target.value })))}
                    style={{ width: 200, padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: font, fontSize: 13 }}
                  />
                  <button style={{ ...btn(false), padding: '6px 12px' }} onClick={() => edit(() => setNames((n) => ({ ...n, [id]: 'Coach' })))}>Coach</button>
                  <button style={{ ...btn(false), padding: '6px 12px' }} onClick={() => edit(() => setNames((n) => ({ ...n, [id]: 'Client' })))}>Client</button>
                </div>
              ))}
              {speakerIds.length === 2 && (
                <button style={{ ...btn(false), padding: '6px 12px', marginTop: 4 }} onClick={swapTwoSpeakers}>Swap the two names</button>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
                <button style={btn(true, saving)} disabled={saving} onClick={save}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save to my transcripts'}</button>
                <button style={btn(false)} onClick={download}>Download .txt</button>
                <button style={btn(false)} onClick={copy}>Copy</button>
                <button style={{ ...btn(false), borderColor: C.orange, color: C.orange }} onClick={sendToScorer}>Send to Transcript Reviewer</button>
                <button style={{ ...btn(false), borderColor: C.gray, color: C.gray }} onClick={startOver}>Start over</button>
              </div>
            </div>

            <div style={card}>
              <h2 style={{ fontSize: 15, color: C.navy, margin: '0 0 4px' }}>Who did the talking</h2>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
                {bd.hasTime
                  ? `Share of speaking time${duration ? ` (recording length ${stamp(duration)}; pauses are not counted)` : ''}. Word counts update as you edit.`
                  : 'Timing was not saved for this transcript, so this shows word counts only.'}
              </div>
              {bd.rows.map((r, i) => {
                const pct = bd.hasTime ? r.timePct : r.wordPct
                return (
                  <div key={r.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
                      <strong>{nameOf(r.id)}</strong>
                      <span style={{ color: C.gray }}>
                        {bd.hasTime ? `${stamp(r.seconds)} · ${r.timePct.toFixed(0)}% of time · ` : ''}
                        {r.words.toLocaleString()} words ({r.wordPct.toFixed(0)}%) · {r.turns} {r.turns === 1 ? 'turn' : 'turns'}
                      </span>
                    </div>
                    <div style={{ height: 10, background: C.soft, borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: [C.navy, C.sky, C.orange, C.green][i % 4] }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={card}>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
                Edit any text directly. Change who spoke a passage with the menu, or remove or join passages.
              </div>
              {turns.map((t, i) => (
                <div key={t.id} style={{ borderTop: i ? `1px solid ${C.border}` : 'none', padding: '12px 0' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.gray, minWidth: 48 }}>{stamp(t.start)}</span>
                    <select
                      value={t.speaker}
                      onChange={(e) => updateTurn(t.id, { speaker: Number(e.target.value) })}
                      style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: C.navy, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}` }}
                    >
                      {speakerIds.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                    </select>
                    <span style={{ flex: 1 }} />
                    {i > 0 && <button onClick={() => mergeUp(t.id)} style={linkBtn(C.blue)}>Join with above</button>}
                    <button onClick={() => removeTurn(t.id)} style={linkBtn(C.orange)}>Remove</button>
                  </div>
                  <textarea
                    value={t.text}
                    onChange={(e) => updateTurn(t.id, { text: e.target.value })}
                    rows={Math.max(2, Math.ceil(t.text.length / 110))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: font, fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

const linkBtn = (color) => ({ background: 'none', border: 'none', color, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: font })
