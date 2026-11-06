// Turning a recording or a pasted/uploaded transcript into a list of turns:
//   { id, speaker (number), label (name in the source), time ('05:32' or ''), start (seconds or null),
//     text, pauseBefore (seconds) }
import { authFetch } from '../authFetch'

export function stamp(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function timeToSeconds(t) {
  if (!t) return null
  const p = t.split(':').map(Number)
  if (p.some((n) => Number.isNaN(n))) return null
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
}

const TIME = '\\[?\\(?(\\d{1,2}:\\d{2}(?::\\d{2})?)\\)?\\]?'
const RE_HEADER = new RegExp(`^(.{1,40}?)\\s+${TIME}\\s*$`) // "Speaker 1  00:05"
const RE_TIME_FIRST = new RegExp(`^${TIME}\\s*[-–]?\\s*(.*)$`) // "[00:05] Coach: ..."
const RE_SPEAKER = /^([^:\n]{1,40}):\s+(.+)$/ // "Coach: text"
const RE_NAME_TIME_TEXT = new RegExp(`^([^:\\n]{1,40}?)\\s*${TIME}\\s*:\\s*(.+)$`) // "Coach (00:05): text"

/** Splits plain transcript text into turns. Understands the common formats. */
export function parseTranscriptText(raw) {
  const lines = String(raw || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
  const turns = []
  let open = null // a turn that may still receive continuation lines
  const push = (label, time, text) => {
    const t = { label: label || '', time: time || '', text: (text || '').trim() }
    turns.push(t)
    open = t
  }
  for (const line of lines) {
    let m
    if ((m = line.match(RE_NAME_TIME_TEXT))) { push(m[1].trim(), m[2], m[3]); continue }
    if ((m = line.match(RE_TIME_FIRST))) {
      const rest = m[2]
      const sp = rest.match(RE_SPEAKER)
      if (sp) push(sp[1].trim(), m[1], sp[2])
      else push('', m[1], rest)
      continue
    }
    if ((m = line.match(RE_SPEAKER))) { push(m[1].trim(), '', m[2]); continue }
    if ((m = line.match(RE_HEADER)) && !/[.?!]$/.test(m[1]) && m[1].split(/\s+/).length <= 4) { push(m[1].trim(), m[2], ''); continue }
    if (open && !open.text) { open.text = line; continue }
    if (open && open.label) { open.text += ' ' + line; continue } // a wrapped line from the same speaker
    push('', '', line)
  }
  const ids = {}
  return turns
    .filter((t) => t.text)
    .map((t, i) => {
      const key = t.label || 'Speaker'
      if (!(key in ids)) ids[key] = Object.keys(ids).length
      return { id: i + 1, speaker: ids[key], label: key, time: t.time, start: timeToSeconds(t.time), text: t.text, pauseBefore: 0 }
    })
}

// ---- Audio: straight to Deepgram with a short-lived token (audio is never stored by us) ----
const DEEPGRAM_URL =
  'https://api.deepgram.com/v1/listen?' +
  new URLSearchParams({
    model: 'nova-3', diarize: 'true', punctuate: 'true', utterances: 'true', smart_format: 'true',
    // Tells Deepgram not to use this audio to train its models.
    mip_opt_out: 'true',
  }).toString()

function turnsFromDeepgram(result) {
  const utterances = result?.results?.utterances
  const turns = []
  let lastEnd = null
  if (Array.isArray(utterances) && utterances.length) {
    for (const u of utterances) {
      const text = (u.transcript || '').trim()
      if (!text) continue
      const prev = lastEnd === null ? 0 : Math.max(0, (u.start || 0) - lastEnd)
      const last = turns[turns.length - 1]
      if (last && last.speaker === (u.speaker ?? 0)) last.text += ' ' + text
      else turns.push({ speaker: u.speaker ?? 0, start: u.start || 0, text, pauseBefore: prev })
      lastEnd = Math.max(lastEnd ?? 0, u.end || 0)
    }
  } else {
    const text = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim()
    if (text) turns.push({ speaker: 0, start: 0, text, pauseBefore: 0 })
  }
  return turns.map((t, i) => ({ id: i + 1, speaker: t.speaker, label: `Speaker ${t.speaker + 1}`, time: stamp(t.start), start: t.start, text: t.text, pauseBefore: t.pauseBefore }))
}

/** Sends the recording to Deepgram. onProgress({label, pct}); xhrRef.current lets the caller cancel. */
export async function transcribeAudio(file, onProgress, xhrRef) {
  onProgress({ label: 'Preparing a secure connection…', pct: 0 })
  const tokRes = await authFetch('/api/user-actions?action=audio-token', { method: 'POST' })
  const tok = await tokRes.json().catch(() => ({}))
  if (!tokRes.ok || !tok.token) throw new Error(tok.error || `Could not start (status ${tokRes.status})`)
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    if (xhrRef) xhrRef.current = xhr
    xhr.open('POST', DEEPGRAM_URL)
    xhr.setRequestHeader('Authorization', `Bearer ${tok.token}`)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100)
        onProgress({ label: pct < 100 ? `Uploading audio… ${pct}%` : 'Transcribing. Long recordings can take a few minutes…', pct })
      }
    }
    xhr.upload.onload = () => onProgress({ label: 'Transcribing. Long recordings can take a few minutes…', pct: 100 })
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
  const turns = turnsFromDeepgram(result)
  if (!turns.length) throw new Error('No speech was found in that recording.')
  return turns
}
