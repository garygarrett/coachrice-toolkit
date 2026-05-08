import React, { useState, useRef, useEffect } from "react";
import Layout from "../../components/Layout";
import { supabase } from "../../lib/supabase";

// ============================================================================
// COMPONENT
// ============================================================================
export default function Assessor2025() {
  const [stage, setStage] = useState("input"); // input | preview | running | report
  const [transcript, setTranscript] = useState("");
  const [filename, setFilename] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [customDownloadFilename, setCustomDownloadFilename] = useState("");
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [usageLog, setUsageLog] = useState([]);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [jsPdfLoaded, setJsPdfLoaded] = useState(false);
  const reportRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load pdf.js for PDF parsing
  useEffect(() => {
    if (window.pdfjsLib) {
      setPdfLibLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      setPdfLibLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Load jsPDF for direct PDF generation (no print dialog needed)
  useEffect(() => {
    if (window.jspdf) {
      setJsPdfLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => setJsPdfLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Load Montserrat font
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  // Load API key and prompt from Supabase config
  useEffect(() => {
    async function loadConfig() {
      const { data } = await supabase.from('config').select('key, value')
      if (data) {
        const map = {}
        data.forEach(row => { map[row.key] = row.value })
        if (map.api_key_assessor_2025) {
          setApiKey(map.api_key_assessor_2025)
        } else if (map.api_key_assessor) {
          // Fallback to shared assessor key if 2025-specific not set
          setApiKey(map.api_key_assessor)
        }
        if (map.ai_assessor_2025_prompt) {
          setSystemPrompt(map.ai_assessor_2025_prompt)
        }
      }
    }
    loadConfig()
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFilename(file.name);

    if (file.type === "application/pdf") {
      if (!pdfLibLoaded) {
        setError("PDF library still loading. Try again in a moment.");
        return;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item) => item.str).join(" ");
          fullText += pageText + "\n\n";
        }
        setTranscript(fullText.trim());
      } catch (err) {
        setError("Could not extract text from this PDF. It may be scanned or image-based. Try pasting the transcript directly.");
      }
    } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const text = await file.text();
      setTranscript(text);
    } else {
      setError("Please upload a PDF or .txt file, or paste the transcript directly.");
    }
  };

  const runEvaluation = async () => {
    if (!transcript.trim()) {
      setError("Please provide a transcript before running the evaluation.");
      return;
    }
    if (!apiKey.trim()) {
      setError("API key not loaded. Please check admin settings and ensure the API key is configured.");
      return;
    }
    if (!systemPrompt.trim()) {
      setError("System prompt not loaded. Please check admin settings and ensure the 2025 assessor prompt is configured.");
      return;
    }
    setError("");
    setStage("running");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-7",
          max_tokens: 8000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Please evaluate the following coaching session transcript. Respond with the JSON object only, no prose before or after.\n\n--- TRANSCRIPT ---\n\n${transcript}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error: ${response.status} — ${errText.slice(0, 200)}`);
      }

      const data = await response.json();

      // Capture usage for cost tracking. Opus 4.7 pricing: $5/MTok input, $25/MTok output.
      if (data.usage) {
        const inputTokens = data.usage.input_tokens || 0;
        const outputTokens = data.usage.output_tokens || 0;
        const cost =
          (inputTokens * 5 / 1_000_000) +
          (outputTokens * 25 / 1_000_000);
        setUsageLog((prev) => [
          ...prev,
          {
            date: new Date().toLocaleString(),
            inputTokens,
            outputTokens,
            cost: cost.toFixed(4),
          },
        ]);
      }

      const rawText = data.content?.[0]?.text || "";

      // Extract JSON (defensive — strip any accidental code fences)
      const cleaned = rawText.replace(/```json\s*/g, "").replace(/```\s*$/g, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        // Try to find a JSON object within the text
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Could not parse evaluation response. Try again.");
      }

      const computed = recomputeScores(parsed);
      setEvaluation(computed);
      const safeName = (computed.coach_identifier || "Coach").replace(/[^a-z0-9]/gi, "_");
      setCustomDownloadFilename(`ACC_Evaluation_2025_${safeName}`);
      setStage("report");
    } catch (err) {
      setError(err.message);
      setStage("preview");
    }
  };

  const downloadPDF = () => {
    if (!jsPdfLoaded || !evaluation) {
      alert("PDF library still loading. Try again in a moment.");
      return;
    }

    try {
      doDownloadPDF();
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert(
        "PDF download failed. Error: " + (err?.message || "unknown") +
        "\n\nTry the 'Download Text Report' button instead — it always works."
      );
    }
  };

  // Plain text download — guaranteed to work
  const downloadText = () => {
    if (!evaluation) return;

    const sc = evaluation.score_calculation || {};
    const ep = evaluation.ethical_practice || {};
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const competencyTitles = {
      3: "Establishes and Maintains Agreements",
      4: "Cultivates Trust and Safety",
      5: "Maintains Presence",
      6: "Listens Actively",
      7: "Evokes Awareness",
      8: "Facilitates Client Growth",
    };

    const grouped = {};
    (evaluation.behavioral_statements || []).forEach((s) => {
      const c = parseInt(s.code.split(".")[0], 10);
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(s);
    });

    let report = `
═══════════════════════════════════════════════════════════
CoachRICE LEVEL 1 ACC PERFORMANCE EVALUATION
Internal Assessor (2025) — Nov 2025 BARS Guide (rev. 11.18.2025)
═══════════════════════════════════════════════════════════

Coach: ${evaluation.coach_identifier || "Not provided"}
Date: ${dateStr}

PASS/FAIL OUTCOME: ${sc.result || "—"} (Score: ${(sc.final_score || 0).toFixed(2)}/10)
Pass threshold: ≥ 3.4

───────────────────────────────────────────────────────────
ETHICAL PRACTICE (Competency 1)
───────────────────────────────────────────────────────────

ICF Code of Ethics Alignment: ${ep.icf_code_alignment || "—"}
${ep.icf_code_alignment_note ? `  Note: ${ep.icf_code_alignment_note}` : ""}

Coach Role Alignment: ${ep.coach_role_alignment || "—"}
${ep.coach_role_alignment_note ? `  Note: ${ep.coach_role_alignment_note}` : ""}

───────────────────────────────────────────────────────────
COACHING MINDSET (Competency 2)
───────────────────────────────────────────────────────────

Per the Nov 2025 ACC BARS Resource Guide, Competency 2 (Embodies a Coaching Mindset)
is evaluated via the ICF ACC Exam, not via BARS in this performance assessment.

───────────────────────────────────────────────────────────
BEHAVIORAL STATEMENTS & RATINGS
───────────────────────────────────────────────────────────

${[3, 4, 5, 6, 7, 8]
  .map((c) => {
    const skills = grouped[c] || [];
    const avg = sc[`competency_${c}_average`];
    return `\n${competencyTitles[c]} (Competency ${c})
Average: ${avg.toFixed(2)}
${skills
  .map(
    (s) =>
      `  ${s.code} — ${s.title}
    Rating: ${s.rating} (Score: ${s.score !== null ? s.score : "N/A"})`
  )
  .join("\n")}`;
  })
  .join("\n")}

───────────────────────────────────────────────────────────
SCORE CALCULATION
───────────────────────────────────────────────────────────

Competency 3 (Establishes and Maintains Agreements): ${sc.competency_3_average.toFixed(2)}
Competency 4 (Cultivates Trust and Safety): ${sc.competency_4_average.toFixed(2)}
Competency 5 (Maintains Presence): ${sc.competency_5_average.toFixed(2)}
Competency 6 (Listens Actively): ${sc.competency_6_average.toFixed(2)}
Competency 7 (Evokes Awareness): ${sc.competency_7_average.toFixed(2)}
Competency 8 (Facilitates Client Growth): ${sc.competency_8_average.toFixed(2)}

Raw Score: ${sc.raw_score.toFixed(2)} (average of six competencies)
Final Score: ${sc.final_score.toFixed(2)}/10
Conversion: (${sc.raw_score.toFixed(2)} − 1) × 2.5

${sc.result === "Pass" ? "✓ PASSES" : "✗ BELOW PASSING STANDARD"}

───────────────────────────────────────────────────────────
STRENGTHS
───────────────────────────────────────────────────────────

${(evaluation.strengths || [])
  .map(
    (s, i) =>
      `${i + 1}. ${s.code} — ${s.statement_title}
Competency: ${s.competency_name}
${s.explanation}`
  )
  .join("\n\n") || "None identified."}

───────────────────────────────────────────────────────────
SUGGESTIONS FOR DEVELOPMENT
───────────────────────────────────────────────────────────

${(evaluation.suggestions || [])
  .map(
    (s, i) =>
      `${i + 1}. ${s.code} — ${s.statement_title}
Competency: ${s.competency_name}
Missed Opportunity: ${s.missed_opportunity}
Example Prompts:
  • ${s.example_prompts?.[0] || "—"}
  • ${s.example_prompts?.[1] || "—"}`
  )
  .join("\n\n") || "None identified."}

───────────────────────────────────────────────────────────
EVALUATION NOTES
───────────────────────────────────────────────────────────

${evaluation.ethical_concerns && evaluation.ethical_concerns !== "None"
  ? `Ethical Concerns: ${evaluation.ethical_concerns}`
  : "No ethical concerns identified."}

Divergence Flags (skills where human assessors may read the evidence differently):
${(evaluation.divergence_flags || []).length > 0
  ? (evaluation.divergence_flags || [])
      .map(
        (f) =>
          `  ${f.code}: AI rated ${f.ai_rating}; human assessors likely to rate ${f.likely_human_rating}
    Reason: ${f.reason}`
      )
      .join("\n")
  : "  None."}

═══════════════════════════════════════════════════════════
`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customDownloadFilename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Stub for PDF generation (matches Assessor.jsx structure)
  const doDownloadPDF = () => {
    alert("PDF generation for 2025 assessor coming soon. Use 'Download Text Report' for now.");
  };

  // Recompute scores based on ratings
  const recomputeScores = (evaluation) => {
    const competencies = {
      3: [], 4: [], 5: [], 6: [], 7: [], 8: [],
    };

    const scoreMap = {
      "Exceeds the Standard": 5,
      "Meets the Standard": 4,
      "Below the Standard": 2,
      "Does Not Meet Standard": 1,
      "N/A": null,
    };

    (evaluation.behavioral_statements || []).forEach((s) => {
      const c = parseInt(s.code.split(".")[0], 10);
      if (competencies[c] !== undefined) {
        const score = scoreMap[s.rating] !== undefined ? scoreMap[s.rating] : null;
        if (score !== null) {
          competencies[c].push(score);
        }
      }
    });

    const competencyAverages = {};
    let totalScore = 0;
    let totalCount = 0;

    [3, 4, 5, 6, 7, 8].forEach((c) => {
      const scores = competencies[c];
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        competencyAverages[`competency_${c}_average`] = parseFloat(avg.toFixed(2));
        totalScore += avg;
        totalCount++;
      } else {
        competencyAverages[`competency_${c}_average`] = 0;
      }
    });

    const rawScore = totalCount > 0 ? totalScore / totalCount : 0;
    const finalScore = (rawScore - 1) * 2.5;

    return {
      ...evaluation,
      score_calculation: {
        ...evaluation.score_calculation,
        ...competencyAverages,
        raw_score: parseFloat(rawScore.toFixed(2)),
        final_score: parseFloat(finalScore.toFixed(2)),
        result: finalScore >= 3.4 ? "Pass" : "Below Passing Standard",
      },
    };
  };

  return (
    <Layout active="assessor2025" pageTitle="Internal Assessor (2025)">
      <div style={styles.container}>
        {/* STAGE: Input */}
        {stage === "input" && (
          <div style={styles.card}>
            <h1 style={styles.title}>Internal Assessor (2025)</h1>
            <p style={styles.subtitle}>
              Evaluate a coaching session transcript against the ACC BARS (Nov 2025 guide)
            </p>

            <div style={styles.inputSection}>
              <label style={styles.label}>Upload transcript or paste directly:</label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your coaching session transcript here… (or use the file uploader below)"
                style={styles.textarea}
              />

              <div style={styles.fileUploadArea}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.uploadBtn}
                >
                  📎 Upload PDF or .txt
                </button>
                {filename && <span style={styles.filename}>{filename}</span>}
              </div>

              {error && <div style={styles.error}>{error}</div>}
            </div>

            <div style={styles.actions}>
              <button
                onClick={() => setStage("preview")}
                disabled={!transcript.trim()}
                style={{
                  ...styles.button,
                  opacity: transcript.trim() ? 1 : 0.5,
                }}
              >
                Preview & Run Evaluation
              </button>
            </div>
          </div>
        )}

        {/* STAGE: Preview */}
        {stage === "preview" && (
          <div style={styles.card}>
            <h2 style={styles.subtitle}>Review Transcript</h2>
            <div style={styles.previewBox}>{transcript}</div>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.actions}>
              <button
                onClick={() => setStage("input")}
                style={styles.secondaryBtn}
              >
                ← Back
              </button>
              <button
                onClick={runEvaluation}
                style={styles.button}
              >
                Run Evaluation
              </button>
            </div>
          </div>
        )}

        {/* STAGE: Running */}
        {stage === "running" && (
          <div style={styles.card}>
            <div style={{ textAlign: "center" }}>
              <div style={styles.spinner}>⏳</div>
              <h2 style={styles.subtitle}>Evaluating transcript…</h2>
              <p>This typically takes 30–60 seconds.</p>
            </div>
          </div>
        )}

        {/* STAGE: Report */}
        {stage === "report" && evaluation && (
          <div style={styles.card} ref={reportRef}>
            <div style={styles.reportHeader}>
              <h1>ACC Performance Evaluation (2025)</h1>
              <p>Internal Assessor — Nov 2025 BARS Guide</p>
            </div>

            <div style={styles.result}>
              <div
                style={{
                  ...styles.resultBadge,
                  background:
                    evaluation.score_calculation?.result === "Pass"
                      ? "#10b981"
                      : "#ef4444",
                }}
              >
                {evaluation.score_calculation?.result || "—"}
              </div>
              <div>
                <div style={styles.score}>
                  {(evaluation.score_calculation?.final_score || 0).toFixed(2)}/10
                </div>
                <div style={styles.scoreLabel}>Final Score</div>
              </div>
            </div>

            <div style={styles.actions}>
              <button onClick={downloadText} style={styles.button}>
                📄 Download Text Report
              </button>
              <button
                onClick={downloadPDF}
                style={styles.secondaryBtn}
              >
                📕 Download PDF
              </button>
              <button
                onClick={() => {
                  setTranscript("");
                  setEvaluation(null);
                  setStage("input");
                }}
                style={styles.tertiaryBtn}
              >
                ← New Evaluation
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  container: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "32px 16px",
  },
  card: {
    background: "#fff",
    borderRadius: "10px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.09)",
    padding: "2rem",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#00205B",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#666",
    margin: "0 0 24px",
  },
  inputSection: {
    marginBottom: "24px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "#00205B",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  textarea: {
    width: "100%",
    minHeight: "200px",
    padding: "12px",
    border: "1px solid #e2e6ec",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "monospace",
    marginBottom: "16px",
  },
  fileUploadArea: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
  },
  uploadBtn: {
    padding: "8px 16px",
    background: "#f0f2f5",
    border: "1px solid #e2e6ec",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },
  filename: {
    fontSize: "12px",
    color: "#666",
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: "12px",
    borderRadius: "6px",
    fontSize: "12px",
    marginBottom: "16px",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  },
  button: {
    padding: "10px 16px",
    background: "#00205B",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "Montserrat, sans-serif",
  },
  secondaryBtn: {
    padding: "10px 16px",
    background: "#f0f2f5",
    color: "#00205B",
    border: "1px solid #e2e6ec",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "Montserrat, sans-serif",
  },
  tertiaryBtn: {
    padding: "10px 16px",
    background: "#fff",
    color: "#666",
    border: "1px solid #e2e6ec",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "Montserrat, sans-serif",
  },
  previewBox: {
    background: "#f0f2f5",
    border: "1px solid #e2e6ec",
    borderRadius: "6px",
    padding: "12px",
    maxHeight: "300px",
    overflowY: "auto",
    fontSize: "11px",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    marginBottom: "16px",
  },
  spinner: {
    fontSize: "48px",
    marginBottom: "16px",
    animation: "spin 1s linear infinite",
  },
  reportHeader: {
    marginBottom: "24px",
    paddingBottom: "16px",
    borderBottom: "2px solid #e2e6ec",
  },
  result: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    marginBottom: "24px",
    padding: "16px",
    background: "#f0f2f5",
    borderRadius: "6px",
  },
  resultBadge: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: "700",
    fontSize: "14px",
  },
  score: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#00205B",
  },
  scoreLabel: {
    fontSize: "12px",
    color: "#666",
  },
};
