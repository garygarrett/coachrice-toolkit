import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Layout from "../../components/Layout";

const SYSTEM_PROMPT_DEFAULT = `## ROLE

You are an ICF ACC assessor for the CoachRICE Level 1 program at the Doerr Institute for New Leaders. Your job is to evaluate a single coaching session transcript against the ICF Associate Certified Coach (ACC) Minimum Skill Requirements (March 2024) and produce a participant-facing performance report.

You do not mentor coach. You do not invent evidence. Every judgment is anchored to a specific moment in the transcript.

## OBSERVED / NOT OBSERVED STANDARD

Each behavioral statement is rated either **Observed** or **Not Observed**:
- **Observed** = the coach demonstrated the behavior at Sufficient level or above
- **Not Observed** = the behavior was absent or attempted but not skillfully executed

When in doubt, mark Not Observed.

## OUTPUT FORMAT

Respond with a single valid JSON object only. No prose. No markdown fences.`;

const CONTENT_DEFAULTS = {
  transcript_start_badge: 'Application',
  transcript_start_title: 'Transcript Reviewer',
  transcript_start_subtitle: 'Submit your anonymized coaching session transcript for evaluation. Receive detailed feedback on your coaching skills against ICC ACC standards.',
  transcript_start_info_1: 'Upload PDF or paste text',
  transcript_start_info_2: 'Instant AI-powered feedback',
  transcript_start_info_3: 'Evaluated against ICC ACC standards',
  theme_primary_color: '#00205B',
};

export default function TranscriptScorer() {
  const [stage, setStage] = useState("input");
  const [consentChecked, setConsentChecked] = useState({ anonymized: false, consent: false, data: false });
  const allConsented = Object.values(consentChecked).every(Boolean);
  const [transcript, setTranscript] = useState("");
  const [filename, setFilename] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState(null);
  const [downloadName, setDownloadName] = useState("");
  const [jsPdfLoaded, setJsPdfLoaded] = useState(false);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [content, setContent] = useState(CONTENT_DEFAULTS);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Fetch page content from site_content table
    supabase
      .from("site_content")
      .select("key, value")
      .in("key", ["transcript_start_badge", "transcript_start_title", "transcript_start_subtitle", "transcript_start_info_1", "transcript_start_info_2", "transcript_start_info_3"])
      .then(({ data }) => {
        if (data?.length) {
          const map = {};
          data.forEach(row => { map[row.key] = row.value });
          setContent(prev => ({ ...prev, ...map }));
        }
      });

    // Fetch API key and prompt from config table
    supabase
      .from("config")
      .select("key, value")
      .in("key", ["api_key_transcript", "transcript_reviewer_prompt"])
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(row => { map[row.key] = row.value });
          if (map.api_key_transcript) setApiKey(map.api_key_transcript);
          if (map.transcript_reviewer_prompt) setSystemPrompt(map.transcript_reviewer_prompt);
        }
        // Set default if not found
        if (!data?.some(r => r.key === 'transcript_reviewer_prompt')) setSystemPrompt(SYSTEM_PROMPT_DEFAULT);
      });
  }, []);

  // Load PDF.js library
  useEffect(() => {
    if (window.pdfjsLib) { setPdfLibLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      setPdfLibLoaded(true);
    };
    document.head.appendChild(s);
  }, []);

  // Load jsPDF library
  useEffect(() => {
    if (window.jspdf) { setJsPdfLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => setJsPdfLoaded(true);
    document.head.appendChild(s);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFilename(file.name);

    if (file.type === "application/pdf") {
      if (!pdfLibLoaded) { setError("PDF library still loading. Try again in a moment."); return; }
      try {
        const ab = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(it => it.str).join(" ") + "\n\n";
        }
        setTranscript(text.trim());
      } catch {
        setError("Could not extract text from this PDF. Try pasting the transcript directly.");
      }
    } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      setTranscript(await file.text());
    } else {
      setError("Please upload a PDF or .txt file, or paste the transcript directly.");
    }
  };

  const runEvaluation = async () => {
    if (!transcript.trim()) { setError("Please provide a transcript."); return; }
    if (!apiKey) { setError("API configuration not found. Please contact support."); return; }
    if (!systemPrompt) { setError("System prompt not found. Please contact support."); return; }

    setError("");
    setStage("running");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 6000,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: `Evaluate the following coaching session transcript. Respond with the JSON object only, no prose before or after.\n\n--- TRANSCRIPT ---\n\n${transcript}`
          }]
        })
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      const raw = (data.content?.[0]?.text || "").replace(/```json\s*/g, "").replace(/```\s*$/g, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
        else throw new Error("Could not parse response. Please try again.");
      }
      setEvaluation(parsed);
      setStage("report");
    } catch (err) {
      setError(err.message);
      setStage("preview");
    }
  };

  const downloadText = () => {
    if (!evaluation) return;
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const HR = "=".repeat(78);
    const out = [];
    out.push(HR);
    out.push("DOERR INSTITUTE FOR NEW LEADERS  |  COACHRICE LEVEL 1");
    out.push("ACC COACHING SESSION FEEDBACK");
    out.push(HR);
    out.push(`Coach:  ${evaluation.coach_identifier || "Submitted Coach"}`);
    out.push(`Date:   ${dateStr}`);
    out.push(`Rubric: ICF ACC BARS (March 2024)`);
    out.push("");
    const obs = (evaluation.behavioral_statements || []).filter(s => s.result === "Observed").length;
    const tot = (evaluation.behavioral_statements || []).length;
    out.push(`Skills Observed: ${obs} of ${tot}`);
    out.push("");

    const ep = evaluation.ethical_practice || {};
    out.push(HR); out.push("ETHICAL PRACTICE"); out.push(HR);
    out.push(`[${ep.icf_code_alignment === "Observed" ? "X" : " "}] ICF Code of Ethics alignment`);
    if (ep.icf_code_alignment_note) out.push(`    Note: ${ep.icf_code_alignment_note}`);
    out.push(`[${ep.coach_role_alignment === "Observed" ? "X" : " "}] Coach role alignment`);
    if (ep.coach_role_alignment_note) out.push(`    Note: ${ep.coach_role_alignment_note}`);
    out.push("");

    const compTitles = { 3:"Establishes and Maintains Agreements", 4:"Cultivates Trust and Safety", 5:"Maintains Presence", 6:"Listens Actively", 7:"Evokes Awareness", 8:"Facilitates Client Growth" };
    const grouped = {};
    (evaluation.behavioral_statements || []).forEach(s => {
      const c = parseInt(s.code.split(".")[0], 10);
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(s);
    });
    [3,4,5,6,7,8].forEach(n => {
      out.push(HR); out.push(`${n}. ${compTitles[n].toUpperCase()}`); out.push(HR);
      (grouped[n] || []).forEach(s => {
        out.push(`  ${s.code}  [${s.result === "Observed" ? "OBSERVED" : "NOT OBSERVED"}]`);
        out.push(`       ${s.title}`);
        if (s.note) out.push(`       ${s.note}`);
        (s.evidence || []).forEach(e => out.push(`       - ${e.timestamp}  "${e.quote}"`));
        if (s.contra_evidence) out.push(`       Contra: ${s.contra_evidence}`);
        out.push("");
      });
    });

    out.push(HR); out.push("COACHING STRENGTHS"); out.push(HR);
    (evaluation.strengths || []).forEach((s, i) => {
      out.push(`${i+1}. ${s.competency_name} | ${s.code}`);
      out.push(`   ${s.statement_title}`);
      out.push(`   ${s.explanation}`);
      out.push("");
    });

    out.push(HR); out.push("SUGGESTIONS FOR DEVELOPMENT"); out.push(HR);
    (evaluation.suggestions || []).forEach((s, i) => {
      out.push(`${i+1}. ${s.competency_name} | ${s.code}`);
      out.push(`   ${s.statement_title}`);
      out.push(`   ${s.missed_opportunity}`);
      if (s.example_prompts?.length) {
        out.push("   Example prompts:");
        s.example_prompts.forEach(p => out.push(`     - "${p}"`));
      }
      out.push("");
    });

    out.push(HR);
    out.push(`ETHICAL CONCERNS: ${evaluation.ethical_concerns || "None"}`);
    out.push(HR);

    const blob = new Blob([out.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const sn = (downloadName.trim()||evaluation.coach_identifier||"Coach").replace(/[^a-z0-9]/gi,"_");
    a.href = url;
    a.download = `ACC_Feedback_${sn}.txt`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const COLORS = {
    navy: '#00205B',
    teal: '#69cce6',
    orange: '#ff8200',
    gray: '#7C7E7F',
    'gray-light': '#f7f8fa',
    'gray-border': '#e5e7eb',
    'text-main': '#0f1c3a',
    'text-muted': '#6b7a99',
  };

  // INPUT STAGE
  if (stage === "input") {
    return (
      <Layout active="transcript" pageTitle="Transcript Reviewer">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 32px" }}>
          <div style={{ marginBottom: "32px" }}>
            <p style={{ display: 'inline-block', background: '#e8ecf5', color: '#00205B', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0.25rem 0.6rem', borderRadius: '4px', marginBottom: '0.75rem' }}>{content.transcript_start_badge}</p>
            <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#00205B', margin: '0 0 0.5rem' }}>{content.transcript_start_title}</h1>
            <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: '1.6', margin: '0 0 1.25rem' }}>{content.transcript_start_subtitle}</p>
            <ul style={{ color: '#444', fontSize: '0.875rem', paddingLeft: '1.25rem', margin: '0 0 1.75rem', lineHeight: '1.8' }}>
              {[content.transcript_start_info_1, content.transcript_start_info_2, content.transcript_start_info_3]
                .filter(Boolean)
                .map((info, i) => (
                  <li key={i}>{info}</li>
                ))}
            </ul>
          </div>

          {/* Consent Checkboxes */}
          <div style={{ background: '#fff', border: `1px solid ${COLORS['gray-border']}`, borderRadius: '10px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: COLORS.navy, marginBottom: '16px', margin: '0 0 16px' }}>SUBMISSION CONSENT</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentChecked.anonymized}
                  onChange={(e) => setConsentChecked(v => ({ ...v, anonymized: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '13px', color: COLORS['text-main'], lineHeight: '1.5' }}>I have anonymized this transcript to the best of my ability, removing my client's name and any other identifying information.</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentChecked.consent}
                  onChange={(e) => setConsentChecked(v => ({ ...v, consent: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '13px', color: COLORS['text-main'], lineHeight: '1.5' }}>I have obtained informed consent from my client before submitting this transcript for evaluation.</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentChecked.data}
                  onChange={(e) => setConsentChecked(v => ({ ...v, data: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '13px', color: COLORS['text-main'], lineHeight: '1.5' }}>I understand that the Doerr Institute will not store this transcript and is not responsible for any breach of data associated with this AI tool.</span>
              </label>
            </div>
          </div>

          {/* File Upload */}
          <div style={{ background: '#fff', border: `1px solid ${COLORS['gray-border']}`, borderRadius: '10px', padding: '40px', textAlign: 'center', marginBottom: '24px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: COLORS.navy, marginBottom: '8px' }}>
              {filename ? `📎 ${filename}` : "Upload PDF or Text File"}
            </div>
            <div style={{ fontSize: '13px', color: COLORS['text-muted'] }}>
              {filename ? "Click to choose a different file, or paste below" : "Click to upload, or paste transcript directly below"}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Or paste your coaching session transcript here..."
            style={{
              width: '100%',
              minHeight: '300px',
              padding: '16px',
              fontSize: '14px',
              fontFamily: 'monospace',
              border: `1px solid ${COLORS['gray-border']}`,
              borderRadius: '8px',
              marginBottom: '24px',
              boxSizing: 'border-box',
            }}
          />

          {/* Error */}
          {error && (
            <div style={{ background: '#fee', border: '1px solid #fcc', borderRadius: '6px', padding: '12px', marginBottom: '24px', color: '#c00', fontSize: '13px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={runEvaluation}
            disabled={!allConsented || !transcript.trim()}
            style={{
              background: allConsented && transcript.trim() ? COLORS.navy : COLORS.gray,
              color: '#fff',
              border: 'none',
              padding: '12px 32px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: allConsented && transcript.trim() ? 'pointer' : 'not-allowed',
              opacity: allConsented && transcript.trim() ? 1 : 0.6,
            }}
          >
            {stage === 'running' ? 'Evaluating...' : 'Get Feedback'}
          </button>
        </div>
      </Layout>
    );
  }

  // RUNNING STAGE
  if (stage === "running") {
    return (
      <Layout active="transcript" pageTitle="Transcript Reviewer">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "120px 32px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px", animation: "spin 2s linear infinite" }}>⏳</div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: COLORS.navy, margin: "0 0 8px" }}>
            Analyzing Your Session
          </h2>
          <p style={{ fontSize: "15px", color: COLORS.gray, margin: 0 }}>
            This usually takes 30–60 seconds. We're reading through your transcript and evaluating your coaching against the ICC ACC competencies.
          </p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </Layout>
    );
  }

  // REPORT STAGE
  if (stage === "report" && evaluation) {
    return (
      <Layout active="transcript" pageTitle="Transcript Reviewer">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px" }}>
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: COLORS.gray, letterSpacing: "0.5px" }}>
                DOWNLOAD NAME (optional)
              </label>
              <input
                type="text"
                value={downloadName}
                onChange={(e) => setDownloadName(e.target.value)}
                placeholder="Coach name or session identifier"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "14px",
                  border: `1px solid ${COLORS['gray-border']}`,
                  borderRadius: "6px",
                  boxSizing: "border-box",
                  marginTop: "6px",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={downloadText}
                style={{
                  background: COLORS.navy,
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginTop: '28px',
                }}
              >
                📄 Download Text
              </button>
            </div>
          </div>

          {/* Simple Feedback Display */}
          <div style={{ background: '#fff', border: `1px solid ${COLORS['gray-border']}`, borderRadius: '10px', padding: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: COLORS.navy, marginBottom: '8px' }}>
              Your Coaching Feedback
            </h2>
            <p style={{ fontSize: '13px', color: COLORS['text-muted'], marginBottom: '24px' }}>
              Coach: {evaluation.coach_identifier || 'Submitted Coach'}
            </p>

            {/* Skills Observed */}
            <div style={{ marginBottom: '32px', padding: '16px', background: COLORS['gray-light'], borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.gray, letterSpacing: '1px', marginBottom: '8px' }}>SKILLS OBSERVED</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: COLORS.navy }}>
                {(evaluation.behavioral_statements || []).filter(s => s.result === "Observed").length} / {evaluation.behavioral_statements?.length || 0}
              </div>
            </div>

            {/* Behavioral Statements */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.navy, marginBottom: '16px' }}>Behavioral Statements</h3>
              {(evaluation.behavioral_statements || []).map((s, i) => (
                <div key={i} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${COLORS['gray-border']}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: COLORS.navy }}>{s.code}</span>
                    <span style={{ fontWeight: 600, color: s.result === 'Observed' ? '#16a34a' : '#dc2626' }}>
                      {s.result === 'Observed' ? '✓ Observed' : '✗ Not Observed'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: COLORS['text-main'] }}>{s.title}</div>
                </div>
              ))}
            </div>

            {/* Strengths */}
            {evaluation.strengths && evaluation.strengths.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.navy, marginBottom: '16px' }}>Coaching Strengths</h3>
                {evaluation.strengths.map((s, i) => (
                  <div key={i} style={{ marginBottom: '16px', padding: '12px', background: '#f0fdf4', borderLeft: '4px solid #16a34a' }}>
                    <div style={{ fontWeight: 600, color: COLORS.navy, marginBottom: '4px' }}>{s.competency_name}</div>
                    <div style={{ fontSize: '13px', color: COLORS['text-main'] }}>{s.explanation}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {evaluation.suggestions && evaluation.suggestions.length > 0 && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.navy, marginBottom: '16px' }}>Suggestions for Development</h3>
                {evaluation.suggestions.map((s, i) => (
                  <div key={i} style={{ marginBottom: '16px', padding: '12px', background: '#fef2f2', borderLeft: '4px solid #dc2626' }}>
                    <div style={{ fontWeight: 600, color: COLORS.navy, marginBottom: '4px' }}>{s.competency_name}</div>
                    <div style={{ fontSize: '13px', color: COLORS['text-main'], marginBottom: '8px' }}>{s.missed_opportunity}</div>
                    {s.example_prompts && s.example_prompts.length > 0 && (
                      <div style={{ fontSize: '12px', color: COLORS['text-muted'] }}>
                        <strong>Try asking:</strong> "{s.example_prompts[0]}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setStage("input")}
            style={{
              marginTop: '24px',
              background: 'none',
              border: `1px solid ${COLORS.navy}`,
              color: COLORS.navy,
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            ← Evaluate Another Transcript
          </button>
        </div>
      </Layout>
    );
  }

  return null;
}
