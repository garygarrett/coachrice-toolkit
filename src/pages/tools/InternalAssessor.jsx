import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import { AssessmentReportDisplay } from '../../components/AssessmentReport'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { authFetch } from '../../lib/authFetch'
import { aiJson } from '../../lib/ai'
import { VERSIONS, pickPrompt } from '../../lib/assessor/versions'
import { recomputeScores, validateEvaluation } from '../../lib/assessor/scoring'
import { buildAssessorPdf } from '../../lib/assessor/pdf'

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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export default function InternalAssessor() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [versionId, setVersionId] = useState(searchParams.get('version') === '2021' ? '2021' : '2025')
  const [queue, setQueue] = useState([]) // [{ id, filename, text }]
  const [pasted, setPasted] = useState('')
  const [results, setResults] = useState([])
  const [viewIndex, setViewIndex] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const [error, setError] = useState('')
  const [savedPrompts, setSavedPrompts] = useState({})
  const [totalCost, setTotalCost] = useState(0)
  const [libs, setLibs] = useState({ pdfjs: false, jspdf: false })
  const nextId = useRef(1)
  const version = VERSIONS[versionId]

  // Montserrat + the PDF libraries
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap'
    document.head.appendChild(link)

    ;(async () => {
      try {
        if (!window.pdfjsLib) {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }
        setLibs((l) => ({ ...l, pdfjs: true }))
      } catch { /* shown when a PDF is added */ }
      try {
        if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
        if (!window.jspdf?.jsPDF?.prototype?.autoTable) {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
        }
        setLibs((l) => ({ ...l, jspdf: true }))
      } catch { /* the download button stays disabled */ }
    })()
  }, [])

  // Saved prompts from the admin panel (used only if they still match the expected format)
  useEffect(() => {
    supabase
      .from('config')
      .select('key, value')
      .in('key', Object.values(VERSIONS).map((v) => v.promptConfigKey))
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach((r) => { map[r.key] = r.value })
        setSavedPrompts(map)
      })
  }, [])

  async function readFile(file) {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      if (!window.pdfjsLib) throw new Error('The PDF reader is still loading. Try again in a moment.')
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent()
        text += content.items.map((it) => it.str).join(' ') + '\n\n'
      }
      if (!text.trim()) throw new Error('No text found. The PDF may be scanned or image-based.')
      return text.trim()
    }
    if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) return (await file.text()).trim()
    throw new Error('Only PDF and .txt files are supported.')
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    setError('')
    const added = []
    for (const file of files) {
      try {
        added.push({ id: nextId.current++, filename: file.name, coachName: '', text: await readFile(file) })
      } catch (err) {
        setError(`${file.name}: ${err.message}`)
      }
    }
    setQueue((q) => [...q, ...added])
  }

  function addPasted() {
    if (!pasted.trim()) return
    setQueue((q) => [...q, { id: nextId.current++, filename: `Pasted transcript ${nextId.current - 1}`, coachName: '', text: pasted.trim() }])
    setPasted('')
  }

  async function saveToHistory(vId, evaluation, filename) {
    if (!user) return
    try {
      await authFetch('/api/internal-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          assessorType: vId,
          transcriptFilename: filename || null,
          assessmentData: evaluation,
          competencyScores: {
            competency_3: evaluation.score_calculation?.competency_3_average,
            competency_4: evaluation.score_calculation?.competency_4_average,
            competency_5: evaluation.score_calculation?.competency_5_average,
            competency_6: evaluation.score_calculation?.competency_6_average,
            competency_7: evaluation.score_calculation?.competency_7_average,
            competency_8: evaluation.score_calculation?.competency_8_average,
          },
        }),
      })
    } catch (err) {
      console.error('Could not save to history:', err)
    }
  }

  async function runAll() {
    if (!queue.length || running) return
    const vId = versionId // lock the version for this run
    const v = VERSIONS[vId]
    const system = pickPrompt(vId, savedPrompts[v.promptConfigKey])
    const items = queue
    setError('')
    setRunning(true)
    setViewIndex(null)
    setResults([])
    setProgress({ done: 0, total: items.length, current: items[0].filename })

    const out = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      setProgress({ done: i, total: items.length, current: item.filename })
      try {
        const parsed = await aiJson(
          v.toolKey,
          {
            system,
            messages: [{
              role: 'user',
              content: `Please evaluate the following coaching session transcript. Respond with the JSON object only, no prose before or after. Inside JSON strings, escape any double quote marks with a backslash.\n\n--- TRANSCRIPT ---\n\n${item.text}`,
            }],
          },
          {
            validate: (raw) => validateEvaluation(vId, raw),
            onUsage: (u) => {
              // Opus 4.7: $5 per million input tokens, $25 per million output tokens
              setTotalCost((c) => c + ((u.input_tokens || 0) * 5 + (u.output_tokens || 0) * 25) / 1_000_000)
            },
          },
        )
        const evaluation = recomputeScores(vId, parsed)
        // A coach name typed in by you wins over whatever the AI found in the transcript
        if (item.coachName.trim()) evaluation.coach_identifier = item.coachName.trim()
        out.push({ filename: item.filename, versionId: vId, status: 'done', evaluation })
        await saveToHistory(vId, evaluation, item.filename)
      } catch (err) {
        out.push({ filename: item.filename, versionId: vId, status: 'error', error: err.message })
      }
      setResults([...out])
    }
    setProgress({ done: items.length, total: items.length, current: '' })
    setQueue([])
    setRunning(false)
    if (out.length === 1 && out[0].status === 'done') setViewIndex(0)
  }

  function downloadPdf(result) {
    try {
      const doc = buildAssessorPdf({ versionId: result.versionId, evaluation: result.evaluation, sourceName: result.filename })
      const base = (result.evaluation.coach_identifier || result.filename).replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_')
      doc.save(`ACC_Evaluation_${result.versionId}_${base}.pdf`)
    } catch (err) {
      console.error(err)
      setError('The PDF could not be created: ' + err.message)
    }
  }

  const btn = (primary, disabled) => ({
    fontFamily: font, fontWeight: 700, fontSize: 13, padding: '11px 20px', borderRadius: 8,
    border: primary ? 'none' : `1px solid ${C.navy}`,
    background: primary ? C.navy : C.white, color: primary ? C.white : C.navy,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  })
  const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }

  return (
    <Layout active="assessor" pageTitle="Internal Assessor">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 32, fontFamily: font, color: '#0f1c3a' }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.gray, marginBottom: 10 }}>1. CHOOSE THE RUBRIC</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.values(VERSIONS).map((v) => (
              <button
                key={v.id}
                disabled={running}
                onClick={() => setVersionId(v.id)}
                style={{
                  flex: '1 1 260px', textAlign: 'left', padding: '14px 18px', borderRadius: 10, fontFamily: font,
                  border: `2px solid ${versionId === v.id ? C.navy : C.border}`,
                  background: versionId === v.id ? '#eef3fb' : C.white,
                  cursor: running ? 'not-allowed' : 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{v.id} version</div>
                <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{v.label} · {v.statements.length} statements</div>
              </button>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.gray, marginBottom: 10 }}>2. ADD TRANSCRIPTS</div>
          <label style={{ ...btn(false, running), display: 'inline-block' }}>
            Upload PDF or .txt files
            <input type="file" accept=".pdf,.txt,application/pdf,text/plain" multiple disabled={running} onChange={handleFiles} style={{ display: 'none' }} />
          </label>
          <span style={{ fontSize: 12, color: C.gray, marginLeft: 12 }}>Pick several files to run them one after another.</span>

          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            disabled={running}
            placeholder="…or paste a transcript here"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 110, marginTop: 16, padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: font, fontSize: 13 }}
          />
          <button onClick={addPasted} disabled={running || !pasted.trim()} style={{ ...btn(false, running || !pasted.trim()), marginTop: 8 }}>Add pasted transcript</button>

          {queue.length > 0 && (
            <div style={{ marginTop: 20 }}>
              {queue.map((q) => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 12px', background: C.soft, borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ flex: '1 1 240px' }}>{q.filename} <span style={{ color: C.gray }}>· {q.text.length.toLocaleString()} characters</span></span>
                  <input
                    type="text"
                    value={q.coachName}
                    disabled={running}
                    onChange={(e) => setQueue((qs) => qs.map((x) => (x.id === q.id ? { ...x, coachName: e.target.value } : x)))}
                    placeholder="Coach name"
                    aria-label={`Coach name for ${q.filename}`}
                    style={{ flex: '1 1 200px', padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: font, fontSize: 13 }}
                  />
                  <button disabled={running} onClick={() => setQueue((qs) => qs.filter((x) => x.id !== q.id))} style={{ background: 'none', border: 'none', color: C.orange, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.gray, marginBottom: 10 }}>3. RUN</div>
          <button onClick={runAll} disabled={running || queue.length === 0} style={btn(true, running || queue.length === 0)}>
            {running ? 'Running…' : `Run ${queue.length || ''} assessment${queue.length === 1 ? '' : 's'} (${version.id} version)`}
          </button>
          {running && (
            <div style={{ marginTop: 16 }}>
              <div style={{ height: 8, background: C.soft, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`, height: '100%', background: C.sky, transition: 'width .3s' }} />
              </div>
              <div style={{ fontSize: 12, color: C.gray, marginTop: 6 }}>
                {progress.done} of {progress.total} done · working on {progress.current}. Each one takes 1–3 minutes. Keep this page open.
              </div>
            </div>
          )}
          {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: '#fff3e6', border: '1px solid #ffe0b2', fontSize: 13 }}>{error}</div>}
        </div>

        {results.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.gray, marginBottom: 10 }}>RESULTS</div>
            {results.map((r, i) => (
              <div key={i} style={{ padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>
                      {r.status === 'done' && r.evaluation.coach_identifier ? `${r.evaluation.coach_identifier} ` : ''}
                      <span style={{ fontWeight: r.status === 'done' && r.evaluation.coach_identifier ? 400 : 700, color: r.status === 'done' && r.evaluation.coach_identifier ? C.gray : C.navy }}>
                        {r.status === 'done' && r.evaluation.coach_identifier ? `· ${r.filename}` : r.filename}
                      </span>
                    </div>
                    {r.status === 'done' ? (
                      <div style={{ fontSize: 12, marginTop: 2 }}>
                        Final score <strong>{r.evaluation.score_calculation.final_score.toFixed(2)}</strong> ·{' '}
                        <strong style={{ color: r.evaluation.score_calculation.result === 'Pass' ? '#3b7d23' : '#c2410c' }}>
                          {r.evaluation.score_calculation.result === 'Pass' ? 'PASS' : 'BELOW PASSING STANDARD'}
                        </strong>{' '}· {VERSIONS[r.versionId].shortLabel}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, marginTop: 2, color: '#c2410c' }}>Could not finish: {r.error}</div>
                    )}
                  </div>
                  {r.status === 'done' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setViewIndex(viewIndex === i ? null : i)} style={btn(false, false)}>{viewIndex === i ? 'Hide report' : 'View report'}</button>
                      <button onClick={() => downloadPdf(r)} disabled={!libs.jspdf} style={btn(true, !libs.jspdf)}>{libs.jspdf ? 'Download PDF' : 'Preparing PDF…'}</button>
                    </div>
                  )}
                </div>
                {viewIndex === i && r.status === 'done' && (
                  <div style={{ marginTop: 16, overflowX: 'auto' }}>
                    <AssessmentReportDisplay assessment={{ assessment_data: r.evaluation, assessor_type: r.versionId, transcript_filename: r.filename }} />
                  </div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 12, color: C.gray, marginTop: 8 }}>
              Results are saved to History automatically. AI cost this session: ${totalCost.toFixed(2)}.
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
