import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import LoadingBar from "../../components/LoadingBar";

const SYSTEM_PROMPT_DEFAULT = `## ROLE

You are an ICF ACC assessor for the CoachRICE Level 1 program at the Doerr Institute for New Leaders. Your job is to evaluate a single coaching session transcript against the ICF Associate Certified Coach (ACC) Minimum Skill Requirements (March 2024) and produce a participant-facing performance report.

You do not mentor coach. You do not invent evidence. Every judgment is anchored to a specific moment in the transcript.

## GROUND RULES

1. Evidence must be locatable. Every judgment is supported by 1–3 specific timestamps or speaker turns. Each evidence entry includes a brief direct quote from the coach (under 15 words).
2. No invention. If you cannot find evidence, mark the skill Not Observed.
3. Stay in the assessor lane. Do not suggest what the coach should have said in the per-skill body. Suggestions belong only in the final Suggestions section.
4. One transcript, one session. Assess only what is in front of you.
5. Use evaluator language: "the coach demonstrated…," "the coach did not demonstrate…"

## OBSERVED / NOT OBSERVED STANDARD

Each behavioral statement is rated either **Observed** or **Not Observed**:

- **Observed** = the coach demonstrated the behavior at Sufficient level or above. Sufficient means the behavior was clearly present at least once in response to what the client presented.
- **Not Observed** = the behavior was absent, or the coach attempted it but did not demonstrate it skillfully. Effort without execution does not count.

When in doubt, mark Not Observed. Do not give the benefit of the doubt.

**Contra-evidence:** Even for skills marked Observed, note contra-evidence when the coach demonstrated the behavior but in a limited, inconsistent, or incomplete way that is worth naming — e.g., the coach paraphrased once but missed several clear opportunities to do so, or acknowledged an insight but did not invite further exploration. Contra-evidence is not limited to Not Observed skills. Leave it empty only if there is genuinely nothing worth flagging.

## CALIBRATION ANCHORS (March 2024 BARS-grounded patterns)

### 3.1 — Invites the client to identify their desired coaching outcome.
- Observed: Coach explicitly asks the client what they want to work on or accomplish.
- Not Observed: Coach assumes the topic or jumps into content without inviting the client to name it.

### 3.2 — Coach and client reach an agreement on what the client wants to accomplish.
- Observed: Coach confirms or restates the desired outcome in a way the client acknowledges.
- Not Observed: Session proceeds without explicit shared understanding of the goal.

### 3.3 — Shows curiosity about the client and how the client relates to what they want to accomplish.
- Observed: Coach asks at least one question about who the client is in relation to the topic — their history, values, identity, or stake in the outcome.
- Not Observed: Coach focuses only on the problem, not the person.

### 3.4 — Attends to the agenda set by the client throughout the session.
- Observed: Coach references or checks in on the agreed topic at some point beyond the opening.
- Not Observed: Agenda is set at the start and never revisited; coach lets the conversation drift without checking.

### 4.1 — Acknowledges client insights and learning in the moment.
- Observed: When the client has a realization or names something new, the coach explicitly recognizes it and invites further exploration.
- Not Observed: Coach moves past insights without acknowledgment, or offers only a generic "mm-hmm."

### 4.2 — Explores the client's expression of feelings, perceptions, concerns, beliefs, or suggestions.
- Observed: Coach notices and asks into at least one emotional or belief-level signal the client offers.
- Not Observed: Coach stays at the surface — facts and actions only, no inquiry into the client's inner experience.

### 4.3 — Expresses support and concern for the client.
- Observed: At least one moment where the coach communicates that the client's experience matters — not just the problem.
- Not Observed: Coach is task-focused throughout with no expressed warmth or care for the person.

### 5.1 — Is curious throughout the session.
- Observed: Open, exploratory questions appear consistently across the session — not just at the start.
- Not Observed: Coach front-loads curiosity then shifts to advice, reflection, or closed questions.

### 5.2 — Acknowledges situations that the client presents.
- Observed: Coach reflects back or names the circumstances the client is describing before moving on.
- Not Observed: Coach jumps to questions or solutions without showing the client's situation has been heard.

### 5.3 — Allows the client to direct the conversation at least some of the time.
- Observed: Coach creates space (silence, open invitations, "where do you want to go?") for the client to steer.
- Not Observed: Coach drives the entire session through their own questions and agenda without yielding.

### 6.1 — Uses summarizing or paraphrasing to make sure they understood the client correctly.
- Observed: Coach puts what the client said back to them in their own words, at least once, to confirm understanding.
- Not Observed: Coach responds to client statements without checking understanding.

### 6.2 — Makes observations that support the client in creating new associations.
- Observed: Coach names a pattern, tension, or connection the client hasn't named themselves, and invites the client to respond to it.
- Not Observed: Coach reflects only what the client already said without adding a new lens.

### 6.3 — Co-creates a shared vision with the client.
- Observed: Coach and client together articulate what the client is moving toward — a future state, not just an action.
- Not Observed: Session stays focused on the problem or action steps without building a picture of what success looks like.

### 7.1 — Acknowledges the client's new awareness, learning, and movement toward the desired outcome.
- Observed: Coach explicitly names the shift or learning the client has had and connects it to where the client wants to go.
- Not Observed: Session ends or moves on without the coach naming what the client has discovered.

### 7.2 — Supports the client in viewing the situation from new or different perspectives.
- Observed: Coach introduces a reframe, a new angle, or a question that helps the client see the situation differently.
- Not Observed: Coach explores the situation only within the client's existing frame.

### 7.3 — Inquires about or explores the client's ideas, beliefs, thinking, emotions, and behaviors in relation to the desired outcome.
- Observed: Coach asks into what the client thinks, believes, or feels about the topic — not just what they plan to do.
- Not Observed: Coach focuses on actions and solutions without exploring the client's inner landscape.

### 8.1 — Partners with the client to create or confirm specific action plans.
- Observed: Coach and client together identify at least one concrete next step the client will take.
- Not Observed: Session ends without any agreed action, or coach directs the action themselves.

### 8.2 — Asks questions to support the client in translating awareness into action.
- Observed: Coach asks at least one question that explicitly bridges the session's learning to what the client will do next.
- Not Observed: Actions are named without connecting them to the session's insights.

### 8.3 — Supports the client to close the session.
- Observed: Coach creates a clear closing moment — checks for completion, asks how the client wants to end, or explicitly signals the wrap.
- Not Observed: Session ends abruptly or trails off without a clear close.

## STRENGTHS ALGORITHM

Select exactly 2 strengths (or fewer only if fewer than 2 skills are Observed):

**Step 1:** Identify all skills marked Observed.
**Step 2:** Pick the 2 skills with the strongest, most specific evidence — where the coach's behavior was clearest and most impactful for the client.
**Step 3:** For each, write 1–2 sentences naming what the coach did well and why it mattered, grounded in a specific moment from the transcript.

## SUGGESTIONS ALGORITHM

Select exactly 2 suggestions (or fewer only if fewer than 2 skills are Not Observed):

**Step 1:** Identify all skills marked Not Observed.
**Step 2:** Using the foundational priority list below, pick the 2 most foundational Not Observed skills across all competencies.

Foundational priority (1 = most foundational):
- Comp 3: 3.1 → 3.2 → 3.4 → 3.3
- Comp 4: 4.1 / 4.2 (tied) → 4.3
- Comp 5: 5.3 → 5.1 → 5.2
- Comp 6: 6.1 → 6.2 → 6.3
- Comp 7: 7.3 → 7.1 → 7.2
- Comp 8: 8.1 → 8.2 → 8.3

**Step 3:** For each selected skill, write:
- A "missed_opportunity" sentence referencing the specific moment in the transcript where the skill was needed.
- Two example prompts the coach could have used at that moment. Each prompt must be a single question only — no stacked questions, no compound sentences. Keep them brief and conversational. Examples of the right register: "What's making that hard?", "And what would that give you?", "Where does that leave you?", "What do you want to do with that?"

## OUTPUT FORMAT

CRITICAL: Respond with a single valid JSON object only. No prose. No markdown fences.

{
  "coach_identifier": "string (from transcript or 'Submitted Coach')",
  "ethical_practice": {
    "icf_code_alignment": "Observed" | "Not Observed",
    "icf_code_alignment_note": "string (only if Not Observed; else empty string)",
    "coach_role_alignment": "Observed" | "Not Observed",
    "coach_role_alignment_note": "string (only if Not Observed; else empty string)"
  },
  "behavioral_statements": [
    {
      "code": "3.1",
      "title": "Coach invites the client to identify their desired coaching outcome.",
      "result": "Observed" | "Not Observed",
      "evidence": [
        { "timestamp": "string (transcript format or 'Coach turn N')", "quote": "brief quote under 15 words" }
      ],
      "note": "string (1 sentence explaining the rating; required for Not Observed, optional for Observed)",
      "contra_evidence": "string (include for any skill — Observed or Not Observed — where the coach's demonstration was limited, inconsistent, or missed clear opportunities. Empty string only if there is genuinely nothing worth flagging.)"
    }
  ],
  "strengths": [
    {
      "code": "string",
      "competency_name": "string",
      "statement_title": "string",
      "explanation": "1–2 sentences naming what the coach did well and why it mattered, with a specific timestamp or moment."
    }
  ],
  "suggestions": [
    {
      "competency_name": "string",
      "code": "string",
      "statement_title": "string",
      "missed_opportunity": "1–2 sentences with timestamp",
      "example_prompts": ["prompt 1", "prompt 2"]
    }
  ],
  "ethical_concerns": "None" | "string"
}

The 19 behavioral_statements MUST appear in this exact order with these exact titles:
3.1: "Coach invites the client to identify their desired coaching outcome."
3.2: "Coach and client reach an agreement on what the client wants to accomplish in the session."
3.3: "Coach shows curiosity about the client and how the client relates to what they want to accomplish."
3.4: "Coach attends to the agenda set by the client throughout the session, unless the client indicates otherwise."
4.1: "Coach acknowledges client insights and learning in the moment."
4.2: "Coach explores the client's expression of feelings, perceptions, concerns, beliefs, or suggestions."
4.3: "Coach expresses support and concern for the client, which may focus on the client's context, problem or situation, rather than the client holistically."
5.1: "Coach is curious throughout the session."
5.2: "Coach acknowledges situations that the client presents."
5.3: "Coach allows the client to direct the conversation at least some of the time."
6.1: "Coach uses summarizing or paraphrasing to make sure they understood the client correctly."
6.2: "Coach makes observations that support the client in creating new associations."
6.3: "Coach co-creates a shared vision with the client."
7.1: "Coach acknowledges the client's new awareness, learning, and movement toward the desired outcome."
7.2: "Coach supports the client in viewing the situation from new or different perspectives."
7.3: "Coach inquires about or explores the client's ideas, beliefs, thinking, emotions, and behaviors in relation to the desired outcome."
8.1: "Coach partners with the client to create or confirm specific action plans."
8.2: "Coach asks questions to support the client in translating awareness into action."
8.3: "Coach supports the client to close the session."`;

const CONTENT_DEFAULTS = {
  transcript_start_badge: '',
  transcript_start_title: '',
  transcript_start_subtitle: '',
  transcript_start_info_1: '',
  transcript_start_info_2: '',
  transcript_start_info_3: '',
  theme_primary_color: '#00205B',
};

export default function TranscriptScorer() {
  const { user } = useAuth();
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
  const [contentLoaded, setContentLoaded] = useState(false);
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
        setContentLoaded(true);
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

      // Save analysis to history
      if (user) {
        try {
          const analysisRes = await fetch('/api/transcript-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              analysisText: JSON.stringify(parsed),
              competencyScores: parsed.behavioral_statements?.reduce((acc, stmt) => {
                acc[stmt.code] = stmt.result;
                return acc;
              }, {}) || null,
            }),
          });

          const analysisResult = await analysisRes.json();
          if (!analysisRes.ok) {
            console.error('[Transcript] Failed to save to history:', analysisResult.error);
          }
        } catch (err) {
          console.error('[Transcript] Error saving to history:', err);
        }
      }
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

  const downloadPDF = () => {
    if (!jsPdfLoaded || !evaluation) { alert("PDF library still loading. Try again in a moment."); return; }
    try { doDownloadPDF(); }
    catch (err) { console.error(err); alert("PDF failed. Use Download Text instead."); }
  };

  const doDownloadPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const NAVY = [0, 32, 91];
    const GRAY = [124, 126, 127];
    const LIGHT = [229, 231, 235];
    const SOFT_BLUE = [120, 179, 224];
    const TEXT = [26, 26, 26];
    const PASS_GREEN = [22, 163, 74];
    const FAIL_RED = [220, 38, 38];
    const PW = 612, PH = 792, MX = 54, MT = 56, MB = 54, CW = 504;
    let y = MT;

    const ensureSpace = (n) => { if (y + n > PH - MB) { doc.addPage(); y = MT; } };
    const measure = (text, width, size) => {
      doc.setFontSize(size);
      return doc.splitTextToSize(String(text || ""), width);
    };
    const LH = (size) => size * 1.35;

    // Header
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("ACC Coaching Session Feedback", MX, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.text("Coach: " + (evaluation.coach_identifier || "Submitted Coach"), MX, y);
    doc.text("Date: " + dateStr, MX + 230, y);
    doc.text("Rubric: ICF ACC BARS (March 2024)", MX + 390, y); y += 18;

    // Skills observed
    const obsCount = (evaluation.behavioral_statements || []).filter(s => s.result === "Observed").length;
    const totCount = (evaluation.behavioral_statements || []).length;
    ensureSpace(60);
    doc.setFillColor(247, 248, 250); doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]); doc.setLineWidth(1);
    doc.roundedRect(MX, y, CW, 50, 4, 4, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text("SKILLS OBSERVED", MX + 14, y + 15);
    doc.setFont("helvetica", "bold"); doc.setFontSize(24);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(obsCount + " / " + totCount, MX + 14, y + 40);
    var barX = MX + 150, barY = y + 18, barW = CW - 168, barH = 10;
    doc.setFillColor(229, 231, 235); doc.roundedRect(barX, barY, barW, barH, 3, 3, "F");
    var fillW = Math.max(2, Math.round((obsCount / totCount) * barW));
    doc.setFillColor(SOFT_BLUE[0], SOFT_BLUE[1], SOFT_BLUE[2]);
    doc.roundedRect(barX, barY, fillW, barH, 3, 3, "F");
    y += 62;

    // Competencies 3-8
    const compTitles = { 3: "Establishes and Maintains Agreements", 4: "Cultivates Trust and Safety", 5: "Maintains Presence", 6: "Listens Actively", 7: "Evokes Awareness", 8: "Facilitates Client Growth" };
    const grouped = {};
    (evaluation.behavioral_statements || []).forEach(s => {
      const c = parseInt(s.code.split(".")[0], 10);
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(s);
    });

    [3, 4, 5, 6, 7, 8].forEach(n => {
      ensureSpace(22);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(n + ". " + compTitles[n], MX, y); y += 14;

      (grouped[n] || []).forEach(s => {
        const titleLines = measure(s.title, CW - 20, 9);
        const noteLines = s.note ? measure(s.note, CW - 20, 8) : [];
        const evLines = [];
        (s.evidence || []).forEach(e => {
          const el = measure(e.timestamp + ": \"" + e.quote + "\"", CW - 20, 8);
          el.forEach(l => evLines.push(l));
        });
        const contraLines = s.contra_evidence ? measure("Contra: " + s.contra_evidence, CW - 20, 8) : [];
        const rowH = titleLines.length * LH(9) + noteLines.length * LH(8) + evLines.length * LH(8) + contraLines.length * LH(8) + 20;
        ensureSpace(rowH);

        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.text(s.code, MX + 8, y + 12);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(titleLines, MX + 30, y + 12);
        const badgeText = s.result === "Observed" ? "OBSERVED" : "NOT OBSERVED";
        doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        doc.setTextColor(s.result === "Observed" ? PASS_GREEN[0] : FAIL_RED[0], s.result === "Observed" ? PASS_GREEN[1] : FAIL_RED[1], s.result === "Observed" ? PASS_GREEN[2] : FAIL_RED[2]);
        doc.text(badgeText, PW - MX - 40, y + 12, { align: "right" });
        var iy = y + titleLines.length * LH(9) + 12;

        if (noteLines.length) {
          doc.setFont("helvetica", "italic"); doc.setFontSize(8);
          doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
          doc.text(noteLines, MX + 30, iy);
          iy += noteLines.length * LH(8);
        }
        if (evLines.length) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8);
          doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
          doc.text(evLines, MX + 30, iy);
          iy += evLines.length * LH(8);
        }
        if (contraLines.length) {
          doc.setFont("helvetica", "italic"); doc.setFontSize(8);
          doc.setTextColor(146, 64, 14);
          doc.text(contraLines, MX + 30, iy);
        }
        y += rowH;
      });
      y += 8;
    });

    // Strengths
    if (evaluation.strengths && evaluation.strengths.length > 0) {
      ensureSpace(20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text("Coaching Strengths", MX, y); y += 16;
      (evaluation.strengths || []).forEach(s => {
        const titleLines = measure(s.statement_title, CW - 20, 10);
        const explLines = measure(s.explanation || "", CW - 20, 9);
        const rowH = titleLines.length * LH(10) + explLines.length * LH(9) + 24;
        ensureSpace(rowH);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]); doc.setLineWidth(0.75);
        doc.rect(MX, y, CW, rowH, "FD");
        doc.setFillColor(201, 214, 71); doc.rect(MX, y, 4, rowH, "F");
        var sy = y + 10;
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.text(titleLines, MX + 12, sy);
        sy += titleLines.length * LH(10);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(explLines, MX + 12, sy);
        y += rowH + 8;
      });
    }

    // Suggestions
    if (evaluation.suggestions && evaluation.suggestions.length > 0) {
      ensureSpace(20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text("Suggestions for Development", MX, y); y += 16;
      (evaluation.suggestions || []).forEach(s => {
        const titleLines = measure(s.statement_title, CW - 20, 10);
        const moLines = measure(s.missed_opportunity || "", CW - 20, 9);
        var pLines = [];
        (s.example_prompts || []).forEach(p => {
          const pl = measure("• \"" + p + "\"", CW - 28, 8);
          pl.forEach(l => pLines.push(l));
        });
        const promptH = pLines.length ? pLines.length * LH(8) + 12 : 0;
        const rowH = titleLines.length * LH(10) + moLines.length * LH(9) + promptH + 24;
        ensureSpace(rowH);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]); doc.setLineWidth(0.75);
        doc.rect(MX, y, CW, rowH, "FD");
        doc.setFillColor(SOFT_BLUE[0], SOFT_BLUE[1], SOFT_BLUE[2]); doc.rect(MX, y, 4, rowH, "F");
        var sy = y + 10;
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
        doc.text(titleLines, MX + 12, sy);
        sy += titleLines.length * LH(10);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
        doc.text(moLines, MX + 12, sy);
        sy += moLines.length * LH(9);
        if (pLines.length) {
          doc.setFont("helvetica", "bold"); doc.setFontSize(8);
          doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
          doc.text("Example prompts:", MX + 12, sy); sy += 10;
          doc.setFont("helvetica", "italic"); doc.setFontSize(8);
          doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
          doc.text(pLines, MX + 16, sy);
        }
        y += rowH + 8;
      });
    }

    const sn = (downloadName.trim() || evaluation.coach_identifier || "Coach").replace(/[^a-z0-9]/gi, "_");
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ACC_Feedback_" + sn + ".pdf";
    a.style.display = "none"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 32px", opacity: contentLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}>
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
          <div style={{ background: '#fff', border: `1px solid ${COLORS['gray-border']}`, borderRadius: '10px', padding: '40px', textAlign: 'center', marginBottom: '24px', cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#69cce6';
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = COLORS['gray-border'];
              e.currentTarget.style.backgroundColor = '#fff';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = COLORS['gray-border'];
              e.currentTarget.style.backgroundColor = '#fff';
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const event = { target: { files: [file] } };
                handleFileUpload(event);
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '16px', fontWeight: 600, color: COLORS.navy, marginBottom: '8px' }}>
              {filename ? filename : "Upload PDF or Text File"}
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
          <div style={{ marginBottom: "24px" }}>
            <LoadingBar />
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: COLORS.navy, margin: "0 0 8px" }}>
            Analyzing Your Session
          </h2>
          <p style={{ fontSize: "15px", color: COLORS.gray, margin: 0 }}>
            This usually takes 30–60 seconds. We're reading through your transcript and evaluating your coaching against the ICC ACC competencies.
          </p>
        </div>
      </Layout>
    );
  }

  // REPORT STAGE
  if (stage === "report" && evaluation) {
    return (
      <Layout active="transcript" pageTitle="Transcript Reviewer">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px", fontFamily: "'Montserrat', sans-serif" }}>
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "240px" }}>
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
                  fontFamily: "'Montserrat', sans-serif",
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
                  background: 'transparent',
                  color: COLORS.navy,
                  border: `1px solid ${COLORS.navy}`,
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: "'Montserrat', sans-serif",
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                📄 Download Text
              </button>
              <button
                onClick={downloadPDF}
                disabled={!jsPdfLoaded}
                style={{
                  background: jsPdfLoaded ? COLORS.navy : COLORS.gray,
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: "'Montserrat', sans-serif",
                  borderRadius: '6px',
                  cursor: jsPdfLoaded ? 'pointer' : 'not-allowed',
                  opacity: jsPdfLoaded ? 1 : 0.5,
                }}
              >
                📥 {jsPdfLoaded ? 'Download PDF' : 'Preparing...'}
              </button>
            </div>
          </div>

          {/* Detailed Feedback Display */}
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

            {/* Competencies 3-8 Grouped */}
            {(() => {
              const compTitles = { 3: 'Establishes and Maintains Agreements', 4: 'Cultivates Trust and Safety', 5: 'Maintains Presence', 6: 'Listens Actively', 7: 'Evokes Awareness', 8: 'Facilitates Client Growth' };
              const grouped = {};
              (evaluation.behavioral_statements || []).forEach(s => {
                const c = parseInt(s.code.split('.')[0], 10);
                if (!grouped[c]) grouped[c] = [];
                grouped[c].push(s);
              });

              return [3, 4, 5, 6, 7, 8].map(comp => (
                <div key={comp} style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: COLORS.navy, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {comp}. {compTitles[comp]}
                  </h3>
                  {(grouped[comp] || []).map(skill => (
                    <div key={skill.code} style={{ background: '#f9fafc', borderRadius: '8px', border: `1px solid ${COLORS['gray-border']}`, padding: '16px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: COLORS.navy }}>{skill.code}</div>
                          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#1a1a1a', marginTop: '4px' }}>{skill.title}</div>
                        </div>
                        <span style={{ display: 'inline-block', padding: '4px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '4px', background: skill.result === 'Observed' ? '#dcfce7' : '#fee2e2', color: skill.result === 'Observed' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap', marginLeft: '12px', flexShrink: 0 }}>
                          {skill.result === 'Observed' ? '✓ Observed' : '✗ Not Observed'}
                        </span>
                      </div>
                      {skill.note && <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>{skill.note}</div>}
                      {skill.evidence && skill.evidence.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#555', marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${COLORS['gray-border']}` }}>
                          <strong>Evidence:</strong> {skill.evidence.map((e, i) => `${e.timestamp}: "${e.quote}"`).join(' · ')}
                        </div>
                      )}
                      {skill.contra_evidence && (
                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${COLORS['gray-border']}` }}>
                          <strong>Contra:</strong> {skill.contra_evidence}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ));
            })()}

            {/* Strengths */}
            {evaluation.strengths && evaluation.strengths.length > 0 && (
              <div style={{ marginBottom: '32px', marginTop: '32px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: COLORS.navy, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coaching Strengths</h3>
                {evaluation.strengths.map((s, i) => (
                  <div key={i} style={{ marginBottom: '16px', padding: '16px', background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: '0 6px 6px 0', border: `1px solid ${COLORS['gray-border']}`, borderLeftWidth: '4px' }}>
                    <div style={{ fontSize: '11px', color: COLORS['text-muted'], fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.competency_name} · {s.code}</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.navy, marginBottom: '8px' }}>{s.statement_title}</div>
                    <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#374151' }}>{s.explanation}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {evaluation.suggestions && evaluation.suggestions.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: COLORS.navy, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suggestions for Development</h3>
                {evaluation.suggestions.map((s, i) => (
                  <div key={i} style={{ marginBottom: '16px', padding: '16px', background: '#fef2f2', borderLeft: '4px solid #dc2626', borderRadius: '0 6px 6px 0', border: `1px solid ${COLORS['gray-border']}`, borderLeftWidth: '4px' }}>
                    <div style={{ fontSize: '11px', color: COLORS['text-muted'], fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.competency_name} · {s.code}</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: COLORS.navy, marginBottom: '8px' }}>{s.statement_title}</div>
                    <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#374151', marginBottom: '8px' }}>{s.missed_opportunity}</div>
                    {s.example_prompts && s.example_prompts.length > 0 && (
                      <div style={{ fontSize: '12px', color: COLORS['text-main'] }}>
                        <strong>Example prompts:</strong>
                        <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                          {s.example_prompts.map((prompt, i) => (
                            <li key={i} style={{ marginBottom: '3px', fontStyle: 'italic' }}>"{prompt}"</li>
                          ))}
                        </ul>
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
