import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { authFetch } from '../../lib/authFetch'
import logoWhite from '../../CoachRICE_White.png'
import { buildTranscriptPdf } from '../../lib/audioTranscriptPdf'

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
const LONG_PAUSE = 3 // seconds; pauses at least this long are counted and can be marked
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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.onload = resolve
    el.onerror = () => reject(new Error('Could not load the PDF tools. Check your internet connection.'))
    document.head.appendChild(el)
  })
}

async function ensurePdfLibs() {
  if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  if (!window.jspdf.jsPDF.prototype.autoTable) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
}

async function urlToDataUrl(url) {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

const SPEAKER_COLORS = [[0, 32, 91], [46, 117, 182], [230, 110, 0], [120, 130, 10]]

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
  let lastEnd = null
  if (Array.isArray(utterances) && utterances.length) {
    for (const u of utterances) {
      const text = (u.transcript || '').trim()
      if (!text) continue
      const dur = Math.max(0, (u.end || 0) - (u.start || 0))
      const prev = lastEnd === null ? null : Math.max(0, (u.start || 0) - lastEnd)
      const last = turns[turns.length - 1]
      if (last && last.speaker === (u.speaker ?? 0)) {
        last.text += ' ' + text
        last.dur += dur
        // A pause inside one speaker's turn
        if (prev) {
          last.quiet += prev
          if (prev > last.quietMax) { last.quietMax = prev; last.quietAt = lastEnd }
        }
      } else {
        turns.push({ speaker: u.speaker ?? 0, start: u.start || 0, dur, text, pauseBefore: prev ?? (u.start || 0), quiet: 0, quietMax: 0, quietAt: 0 })
      }
      lastEnd = Math.max(lastEnd ?? 0, u.end || 0)
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
  const caretRef = useRef({}) // where the cursor last was in each passage's text box

  const [stage, setStage] = useState('input') // input | working | edit
  const [file, setFile] = useState(null)
  const [consent, setConsent] = useState(false)
  const [progress, setProgress] = useState({ label: '', pct: 0 })
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [turns, setTurns] = useState([])
  const [names, setNames] = useState({}) // { speakerId: 'Coach' }
  const [duration, setDuration] = useState(null)
  const [estimatedTiming, setEstimatedTiming] = useState(false)
  const [markPauses, setMarkPauses] = useState(false)
  const [makingPdf, setMakingPdf] = useState(false)
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
      setEstimatedTiming(false)
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
  // ---- Pauses ----
  const keepOriginal = (t) => t._p || { pauseBefore: t.pauseBefore, quiet: t.quiet, quietMax: t.quietMax, quietAt: t.quietAt }
  function removePauseBefore(id) {
    edit(() => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, _p: keepOriginal(t), pauseBefore: 0 } : t))))
  }
  function removeAllPauses() {
    edit(() => setTurns((ts) => ts.map((t) => ({ ...t, _p: keepOriginal(t), pauseBefore: 0, quiet: 0, quietMax: 0, quietAt: 0 }))))
  }
  function restorePauses() {
    edit(() => setTurns((ts) => ts.map((t) => {
      if (!t._p) return t
      const { _p, ...rest } = t
      return { ...rest, ..._p }
    })))
  }

  // ---- Splitting one passage in two (for an interjection) ----
  function splitTurn(id) {
    const t = turns.find((x) => x.id === id)
    const pos = caretRef.current[id]
    if (!t || typeof pos !== 'number' || pos <= 0 || pos >= t.text.length) {
      flash('First click in the text where the speaker changes, then press Split.')
      return
    }
    const before = t.text.slice(0, pos).trim()
    const after = t.text.slice(pos).trim()
    if (!before || !after) { flash('First click in the text where the speaker changes, then press Split.'); return }
    const wb = before.split(/\s+/).length
    const wa = after.split(/\s+/).length
    const share = wb / (wb + wa)
    const hasTime = typeof t.dur === 'number'
    const quiet = t.quiet || 0
    const others = speakerIds.filter((x) => x !== t.speaker)
    const newSpeaker = others.length ? others[0] : t.speaker
    const nextId = Math.max(...turns.map((x) => x.id)) + 1
    const first = {
      ...t, text: before,
      ...(hasTime ? { dur: t.dur * share, quiet: quiet * share, quietMax: Math.min(t.quietMax || 0, quiet * share) } : {}),
      est: true, _p: undefined,
    }
    const second = {
      ...t, id: nextId, speaker: newSpeaker, text: after,
      start: hasTime ? t.start + (t.dur + quiet) * share : t.start,
      pauseBefore: 0,
      ...(hasTime ? { dur: t.dur * (1 - share), quiet: quiet * (1 - share), quietMax: Math.min(t.quietMax || 0, quiet * (1 - share)) } : {}),
      est: true, _p: undefined,
    }
    edit(() => setTurns((ts) => ts.flatMap((x) => (x.id === id ? [first, second] : [x]))))
    caretRef.current[id] = null
  }

  function removeTurn(id) { edit(() => setTurns((ts) => ts.filter((t) => t.id !== id))) }
  function mergeUp(id) {
    edit(() => setTurns((ts) => {
      const i = ts.findIndex((t) => t.id === id)
      if (i <= 0) return ts
      const merged = { ...ts[i - 1], _p: undefined, est: ts[i - 1].est || ts[i].est, text: `${ts[i - 1].text} ${ts[i].text}`.trim(), dur: (ts[i - 1].dur ?? 0) + (ts[i].dur ?? 0),
        quiet: (ts[i - 1].quiet ?? 0) + (ts[i].quiet ?? 0) + (ts[i].pauseBefore ?? 0),
        ...(Math.max(ts[i - 1].quietMax ?? 0, ts[i].quietMax ?? 0) >= (ts[i].pauseBefore ?? 0)
          ? ((ts[i - 1].quietMax ?? 0) >= (ts[i].quietMax ?? 0)
            ? { quietMax: ts[i - 1].quietMax ?? 0, quietAt: ts[i - 1].quietAt ?? 0 }
            : { quietMax: ts[i].quietMax ?? 0, quietAt: ts[i].quietAt ?? 0 })
          : { quietMax: ts[i].pauseBefore ?? 0, quietAt: ts[i].start - (ts[i].pauseBefore ?? 0) }) }
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

  // Silence: gaps between and inside turns, recorded when Deepgram answered.
  // Not available for older saves, which never kept pause data.
  function silenceStats() {
    if (estimatedTiming || !turns.length || !turns.every((t) => typeof t.pauseBefore === 'number')) return null
    let total = 0, longest = 0, longestAt = 0, count = 0
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i]
      const before = i === 0 ? 0 : t.pauseBefore // quiet before the first word is not a pause
      total += before + (t.quiet || 0)
      if (before > longest) { longest = before; longestAt = t.start - before }
      if ((t.quietMax || 0) > longest) { longest = t.quietMax; longestAt = t.quietAt || t.start }
      if (before >= LONG_PAUSE) count++
      if ((t.quietMax || 0) >= LONG_PAUSE) count++
    }
    return { total, longest, longestAt, count, pct: duration ? Math.min(100, (total / duration) * 100) : null }
  }

  function fullText() {
    const lines = []
    turns.forEach((t, i) => {
      if (markPauses && i > 0 && typeof t.pauseBefore === 'number' && t.pauseBefore >= LONG_PAUSE) {
        lines.push(`[pause ${Math.round(t.pauseBefore)} sec]`)
      }
      lines.push(`[${stamp(t.start)}] ${nameOf(t.speaker)}: ${t.text.trim()}`)
    })
    return lines.join('\n\n')
  }

  function download() {
    const blob = new Blob([fullText() + '\n'], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'transcript').replace(/[^\w\- ]+/g, '').trim() || 'transcript'}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function downloadPdf() {
    setError('')
    setMakingPdf(true)
    try {
      await ensurePdfLibs()
      let logoDataUrl = null
      try { logoDataUrl = await urlToDataUrl(logoWhite) } catch { /* the PDF still works without the logo */ }
      const colorOf = (id) => SPEAKER_COLORS[Math.max(0, speakerIds.indexOf(id)) % SPEAKER_COLORS.length]
      const doc = buildTranscriptPdf({
        title: title || 'Untitled transcript',
        dateText: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        durationText: duration ? stamp(duration) : '',
        logoDataUrl,
        showTime: bd.hasTime,
        speakers: bd.rows.map((r) => ({
          name: nameOf(r.id), color: colorOf(r.id),
          timeText: stamp(r.seconds), timePct: r.timePct, words: r.words, wordPct: r.wordPct, turns: r.turns,
        })),
        silence: sil ? {
          totalText: stamp(sil.total),
          pctText: sil.pct !== null ? `${sil.pct.toFixed(0)}%` : '',
          longestText: `${sil.longest.toFixed(1)} sec at ${stamp(sil.longestAt)}`,
        } : null,
        rows: turns.map((t, i) => ({
          time: stamp(t.start),
          speaker: nameOf(t.speaker),
          color: colorOf(t.speaker),
          text: t.text.trim(),
          pauseText: markPauses && i > 0 && typeof t.pauseBefore === 'number' && t.pauseBefore >= LONG_PAUSE ? `pause ${Math.round(t.pauseBefore)} sec` : '',
        })),
      })
      doc.save(`${(title || 'transcript').replace(/[^\w\- ]+/g, '').trim() || 'transcript'}.pdf`)
    } catch (err) {
      setError(err.message || 'The PDF could not be made.')
    }
    setMakingPdf(false)
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
          turns: turns.map(({ speaker, start, dur, text, pauseBefore, quiet, quietMax, quietAt, est }) =>
            estimatedTiming ? { speaker, start, text } : { speaker, start, dur, text, pauseBefore, quiet, quietMax, quietAt, est }),
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
      // Transcripts saved before timing was kept: estimate each turn's length
      // from when the next turn starts (this includes short pauses).
      let estimated = false
      if (Array.isArray(row.turns) && row.turns.length && t.some((x) => typeof x.dur !== 'number') && t.every((x) => typeof x.start === 'number')) {
        t = t.map((x, i) => {
          const end = i < t.length - 1 ? t[i + 1].start : row.duration_seconds
          return typeof end === 'number' ? { ...x, dur: Math.max(0, end - x.start) } : x
        })
        estimated = t.every((x) => typeof x.dur === 'number')
      }
      setEstimatedTiming(estimated)
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
  const sil = silenceStats()

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
                <button style={btn(false, makingPdf)} disabled={makingPdf} onClick={downloadPdf}>{makingPdf ? 'Making PDF…' : 'Download PDF'}</button>
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
                  ? `${estimatedTiming ? 'Estimated share of time (this transcript was saved before exact timing was kept, so pauses between turns are included)' : 'Share of speaking time'}${duration ? ` (recording length ${stamp(duration)}${estimatedTiming ? ')' : '; pauses are not counted)'}` : ''}. Word counts update as you edit.`
                  : 'Timing was not saved for this transcript, so this shows word counts only.'}
              </div>
              {turns.some((t) => t.est) && (
                <div style={{ fontSize: 12, color: C.orange, marginBottom: 12 }}>
                  Passages you split are timed by their share of the words, so those numbers are estimates.
                </div>
              )}
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

            {sil && (
              <div style={card}>
                <h2 style={{ fontSize: 15, color: C.navy, margin: '0 0 12px' }}>Silence</h2>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 13 }}>
                  <div><div style={{ color: C.gray, fontSize: 12 }}>Total silence</div><strong style={{ fontSize: 18, color: C.navy }}>{stamp(sil.total)}</strong>{sil.pct !== null && <span style={{ color: C.gray }}> ({sil.pct.toFixed(0)}% of recording)</span>}</div>
                  <div><div style={{ color: C.gray, fontSize: 12 }}>Longest pause</div><strong style={{ fontSize: 18, color: C.navy }}>{sil.longest.toFixed(1)} sec</strong><span style={{ color: C.gray }}> at {stamp(sil.longestAt)}</span></div>
                  <div><div style={{ color: C.gray, fontSize: 12 }}>Pauses of {LONG_PAUSE}+ seconds</div><strong style={{ fontSize: 18, color: C.navy }}>{sil.count}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                  <button style={{ ...btn(false), padding: '6px 12px' }} onClick={removeAllPauses}>Remove all pauses</button>
                  {turns.some((t) => t._p) && (
                    <button style={{ ...btn(false), padding: '6px 12px', borderColor: C.gray, color: C.gray }} onClick={restorePauses}>Restore removed pauses</button>
                  )}
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, fontSize: 12 }}>
                  <input type="checkbox" checked={markPauses} onChange={(e) => setMarkPauses(e.target.checked)} />
                  Mark pauses of {LONG_PAUSE}+ seconds in the downloaded, copied, saved, and sent text (like [pause 8 sec])
                </label>
              </div>
            )}

            <div style={card}>
              <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
                Edit any text directly. Change who spoke a passage with the menu, or remove or join passages.
              </div>
              {turns.map((t, i) => (
                <div key={t.id} style={{ borderTop: i ? `1px solid ${C.border}` : 'none', padding: '12px 0' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.gray, minWidth: 48 }}>{stamp(t.start)}</span>
                    {i > 0 && typeof t.pauseBefore === 'number' && t.pauseBefore >= 2 && (
                      <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>
                        {Math.round(t.pauseBefore)} sec pause before{' '}
                        <button onClick={() => removePauseBefore(t.id)} style={{ ...linkBtn(C.orange), fontSize: 11, textDecoration: 'underline' }}>remove</button>
                      </span>
                    )}
                    <select
                      value={t.speaker}
                      onChange={(e) => updateTurn(t.id, { speaker: Number(e.target.value) })}
                      style={{ fontFamily: font, fontSize: 12, fontWeight: 700, color: C.navy, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}` }}
                    >
                      {speakerIds.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                    </select>
                    <span style={{ flex: 1 }} />
                    <button onClick={() => splitTurn(t.id)} style={linkBtn(C.blue)}>Split at cursor</button>
                    {i > 0 && <button onClick={() => mergeUp(t.id)} style={linkBtn(C.blue)}>Join with above</button>}
                    <button onClick={() => removeTurn(t.id)} style={linkBtn(C.orange)}>Remove</button>
                  </div>
                  <textarea
                    value={t.text}
                    onChange={(e) => updateTurn(t.id, { text: e.target.value })}
                    onSelect={(e) => { caretRef.current[t.id] = e.target.selectionStart }}
                    onBlur={(e) => { caretRef.current[t.id] = e.target.selectionStart }}
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
