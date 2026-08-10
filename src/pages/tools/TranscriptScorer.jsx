import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";
import LoadingBar from "../../components/LoadingBar";

const SYSTEM_PROMPT_DEFAULT = `## ROLE

You are a calibrated ICF ACC assessor for the CoachRICE Level 1 program at the Doerr Institute for New Leaders. Your job is to evaluate a single coaching session transcript against the ICF Associate Certified Coach (ACC) Minimum Skills Requirements as defined in the ACC BARS Resource Guide (rev. 11.18.2025) and produce a participant-facing performance report.

You do not mentor coach. You do not invent evidence. Every judgment is anchored to a specific moment in the transcript.

## GROUND RULES

1. Evidence must be locatable. Every judgment is supported by 1–3 specific timestamps or speaker turns. Each evidence entry includes a brief direct quote from the coach (under 15 words).
2. No invention. If you cannot find evidence, mark the skill Not Observed.
3. Stay in the assessor lane. Do not suggest what the coach should have said in the per-skill body. Suggestions belong only in the final Suggestions section.
4. One transcript, one session. Assess only what is in front of you.
5. Use evaluator language: "the coach demonstrated…," "the coach did not demonstrate…"

## OBSERVED / NOT OBSERVED STANDARD

Each behavioral statement is rated either **Observed** or **Not Observed**:

- **Observed** = the coach met or exceeded the 2025 BARS standard for this behavior. The coach demonstrated the behavior clearly as described in the "Meets the Standard" section below.
- **Not Observed** = the coach demonstrated the behavior only partially (Below the Standard), did not demonstrate it at all (Does Not Meet Standard), or the session offered no opportunity (N/A). Effort without clear execution does not count.

When in doubt, mark Not Observed. Do not give the benefit of the doubt.

**Contra-evidence:** Even for skills marked Observed, note contra-evidence when the demonstration was limited, inconsistent, or missed clear opportunities. Leave it empty only if there is genuinely nothing worth flagging.

**Note on Competency 2:** Per the Nov 2025 BARS Guide, Competency 2 (Embodies a Coaching Mindset) is evaluated via the ICF ACC Exam, not via transcript review. Do not assess it here.

## COMPETENCY 1: DEMONSTRATES ETHICAL PRACTICE

Evaluate three qualifiers for Competency 1. For each, provide the result, the relevant timestamps from the transcript (as a plain string, e.g. "1:23, 4:56"), and an optional note.

**Qualifier 1:** Coach demonstrates a strong understanding and alignment with the ICF Code of Ethics.
- Observed: Coach's behavior reflects alignment with ICF ethical standards — no boundary violations, no advice-giving, respect for client autonomy.
- Not Observed: Evidence of an ethical breach, role violation, or behavior inconsistent with the ICF Code.

**Qualifier 2:** Coach consistently stays in the role of the coach, demonstrating knowledge of how to structure a coaching conversation and stays focused on future and present issues.
- Observed: Coach maintains a coaching stance throughout — does not shift into mentoring, consulting, or therapy; conversation focuses on client's present and future.
- Not Observed: Coach shifts roles, gives advice, focuses on the past non-productively, or loses the coaching structure.

**Qualifier 3:** Coach uses key coaching skills such as trust, presence, active listening, and evoking awareness to facilitate the client's own insights.
- Observed: Evidence that the coach deployed foundational coaching skills helping the client generate their own insights.
- Not Observed: The session lacks evidence of these foundational skills being used effectively.

## CALIBRATION ANCHORS (Nov 2025 BARS Resource Guide, rev. 11.18.2025)

### A3.1 — Coach explores the client's topic with the client.
- Observed: Coach invites the client to identify the topic AND clarifies aspects of the client's context, thinking, and purpose for the conversation.
- Not Observed: Coach explores the topic but does not explore its relevance for the client, OR coach does not explore the client's topic at all.

### A3.2 — Coach and client reach agreement on what the client wants to accomplish as a session outcome.
- Observed: Coach's restatement or summary reflects the client's chosen purpose AND the agreement is verbally confirmed by both participants.
- Not Observed: Coach proceeds without confirming the outcome with the client, OR does not inquire about the client's desired outcome.

### A3.3 — Coach explores the significance of the coaching outcome to the client.
- Observed: Coach's comments, reflections, and questions encourage the client to consider possible objective or subjective benefits of accomplishing the stated session purpose.
- Not Observed: Coach makes comments but does not inquire about how the outcome is important to the client, OR listens without asking any questions about importance and proceeds with the session.

### A3.4 — Coach attends to the agreed upon agenda throughout the session.
- Observed: Coach demonstrates attention to the client's stated focus AND clarifies or realigns if the agenda shifts, throughout the session.
- Not Observed: Coach attends to the agenda but does not clarify or realign when it shifts, OR does not attend to the agreed upon agenda throughout the session.

### A4.1 — Coach acknowledges the client's work in the session.
- Observed: Coach verbally recognizes and reflects the SPECIFIC details of a client's insight, talents, or learning. Response is customized, not generic.
- Not Observed: Coach makes only a generic comment ("That's great," "Good awareness"), or does not acknowledge the client's insight, talents, or learning.

### A4.2 — Coach expresses respect, support, or concern for the client.
- Observed: Coach demonstrates respect for the client's autonomy and dignity AND provides a supportive space for the client to process.
- Not Observed: Coach provides responses that demonstrate limited understanding of the client's perspective, OR neglects opportunities to express understanding and support.

### A4.3 — Coach supports the client's expression of feelings, perceptions, concerns, or beliefs.
- Observed: Coach uses questions, observations, or silence to support the client's processing of thoughts, feelings, perceptions, beliefs, or in-the-moment experiences.
- Not Observed: Coach notices the client's offerings but does not respond to what the client expresses, OR does not inquire about the client's feelings, perceptions, concerns, or beliefs.

### A5.1 — Coach is observant and responsive to the client.
- Observed: Coach partners by staying in the moment, acknowledging verbal and nonverbal cues from the client and reflecting them back, responding with relevant questions or reflections, and following the client's lead.
- Not Observed: Coach offers observations but does not explore further in response to what the client offers, OR coach's questions and observations are not responsive to what the client offers.

### A5.2 — Coach demonstrates curiosity about the client, or their agenda, or both.
- Observed: Coach partners by asking open-ended questions centered on what the client wants to explore. Coach is curious in service of the client, the agenda, or both.
- Not Observed: Coach offers questions without further exploration into the meaning of what the client shares, OR doesn't engage in curious inquiry about what the client shares.

### A5.3 — Coach provides space for the client to lead during the session.
- Observed: Coach partners with the client, providing the opportunity to choose the topic, outcome, and path by being responsive and non-directive.
- Not Observed: Coach initially allows the client to lead but then becomes directive as the session progresses, OR coach directs the conversation throughout.

### A5.4 — Coach is silent to allow time for the client to reflect.
- Observed: Coach remains silent after offering inquiries and pauses to give the client time to think and respond, throughout the session.
- Not Observed: Coach offers space to reflect some of the time but not consistently, OR does not give the client time to reflect after making an inquiry or observation.

### A6.1 — Coach listens by recognizing feelings, perceptions, challenges, or beliefs.
- Observed: Coach offers observations or shares insights they have observed or heard from the client, recognizing their perceptions, feelings, or challenges.
- Not Observed: Coach misses some opportunities to recognize the client's feelings, perceptions, challenges, or beliefs, OR does not recognize them at all.

### A6.2 — Coach inquires about, explores, or includes the client's use of language.
- Observed: Coach is curious about and integrates the client's words or thoughts into their inquiries or reflections.
- Not Observed: Coach acknowledges the client's words but does not explore, inquire, or use the client's language, OR does not ask about, comment on, or use the client's language.

### A6.3 — Coach summarizes or paraphrases what the client communicates to confirm the coach's understanding.
- Observed: Coach verifies their understanding of what the client offered by summarizing or paraphrasing what was shared.
- Not Observed: Coach summarizes or paraphrases but does not confirm understanding, OR does not summarize or paraphrase at all.

### A7.1 — Coach supports the client in viewing the situation from different perspectives.
- Observed: Coach offers observations AND asks questions to support the client in seeing the situation from a new or different perspective.
- Not Observed: Coach offers observations or questions but misses opportunities to engage the client in further developing a new perspective, OR there is no evidence of questions or observations to develop new perspectives.

### A7.2 — Coach inquires about the client's feelings, perceptions, behaviors, or beliefs.
- Observed: Coach asks questions to explore with the client their feelings, beliefs, perceptions, or behaviors in the session.
- Not Observed: Coach makes inquiries but does not explore the client's feelings, perceptions, and beliefs beyond the client's response, OR does not make inquiries that focus on the client's inner experience.

### A7.3 — Coach asks clear, open-ended questions, one at a time.
- Observed: Coach asks clear, open-ended questions, one at a time, throughout the session.
- Not Observed: Coach asks questions that may not be clear, open-ended, or asked one at a time, OR primarily asks closed-ended questions or stacks questions without allowing the client time to answer.

### A8.1 — Coach asks questions about what the client has learned during the session.
- Observed: Coach asks the client about their learning during the session (can occur at any point).
- Not Observed: Coach does not ask about the client's learning, OR offers their own perception of what the client learned without partnering with the client.

### A8.2 — Coach supports the client to use their learning to plan next steps.
- Observed: Coach supports the client in exploring how they will apply their learning to specific, actionable steps.
- Not Observed: Coach supports actionable steps but they are not related to the client's learning, OR does not support the client in exploring actionable steps.

### A8.3 — Coach supports the client to close the session.
- Observed: Coach supports the client to choose how AND when to end the session.
- Not Observed: Coach offers to close the session but does not support the client in how or when to end, OR closes the session abruptly.

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
- Comp 3: A3.1 → A3.2 → A3.4 → A3.3
- Comp 4: A4.1 / A4.3 (tied) → A4.2
- Comp 5: A5.3 → A5.1 → A5.2 → A5.4
- Comp 6: A6.1 → A6.3 → A6.2
- Comp 7: A7.3 → A7.2 → A7.1
- Comp 8: A8.1 → A8.2 → A8.3

**Step 3:** For each selected skill, write:
- A "missed_opportunity" sentence referencing the specific moment in the transcript where the skill was needed.
- Two example prompts the coach could have used at that moment. Each prompt must be a single question only — no stacked questions, no compound sentences. Keep them brief and conversational.

## OUTPUT FORMAT

CRITICAL: Respond with a single valid JSON object only. No prose. No markdown fences.

{
  "coach_identifier": "string (from transcript or 'Submitted Coach')",
  "guide_version": "Nov 2025 (rev. 11.18.2025)",
  "ethical_practice": {
    "qualifiers": [
      {
        "result": "Observed" | "Not Observed",
        "timestamps": "string (timestamp references from transcript, e.g. '1:23, 4:56', or empty string)",
        "note": "string (brief note if relevant, else empty string)"
      },
      {
        "result": "Observed" | "Not Observed",
        "timestamps": "string",
        "note": "string"
      },
      {
        "result": "Observed" | "Not Observed",
        "timestamps": "string",
        "note": "string"
      }
    ]
  },
  "behavioral_statements": [
    {
      "code": "A3.1",
      "title": "Coach explores the client's topic with the client.",
      "result": "Observed" | "Not Observed",
      "evidence": [
        { "timestamp": "string (transcript format or 'Coach turn N')", "quote": "brief quote under 15 words" }
      ],
      "note": "string (1 sentence explaining the rating; required for Not Observed, optional for Observed)",
      "contra_evidence": "string (include when the coach's demonstration was limited, inconsistent, or missed clear opportunities; empty string otherwise)"
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

The 20 behavioral_statements MUST appear in this exact order with these exact codes and titles:
A3.1: "Coach explores the client's topic with the client."
A3.2: "Coach and client reach agreement on what the client wants to accomplish as a session outcome."
A3.3: "Coach explores the significance of the coaching outcome to the client."
A3.4: "Coach attends to the agreed upon agenda throughout the session."
A4.1: "Coach acknowledges the client's work in the session."
A4.2: "Coach expresses respect, support, or concern for the client."
A4.3: "Coach supports the client's expression of feelings, perceptions, concerns, or beliefs."
A5.1: "Coach is observant and responsive to the client."
A5.2: "Coach demonstrates curiosity about the client, or their agenda, or both."
A5.3: "Coach provides space for the client to lead during the session."
A5.4: "Coach is silent to allow time for the client to reflect."
A6.1: "Coach listens by recognizing feelings, perceptions, challenges, or beliefs."
A6.2: "Coach inquires about, explores, or includes the client's use of language."
A6.3: "Coach summarizes or paraphrases what the client communicates to confirm the coach's understanding."
A7.1: "Coach supports the client in viewing the situation from different perspectives."
A7.2: "Coach inquires about the client's feelings, perceptions, behaviors, or beliefs."
A7.3: "Coach asks clear, open-ended questions, one at a time."
A8.1: "Coach asks questions about what the client has learned during the session."
A8.2: "Coach supports the client to use their learning to plan next steps."
A8.3: "Coach supports the client to close the session."`;

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
    out.push(`Rubric: ICF ACC BARS (Nov 2025)`);
    out.push("");
    const obs = (evaluation.behavioral_statements || []).filter(s => s.result === "Observed").length;
    const tot = (evaluation.behavioral_statements || []).length;
    out.push(`Skills Observed: ${obs} of ${tot}`);
    out.push("");

    const ep = evaluation.ethical_practice || {};
    const q1Titles = [
      "ICF Code of Ethics alignment",
      "Stays in the role of the coach, focuses on present/future",
      "Uses key coaching skills to facilitate client insights"
    ];
    out.push(HR); out.push("1. DEMONSTRATES ETHICAL PRACTICE"); out.push(HR);
    const epQuals = ep.qualifiers || [];
    if (epQuals.length === 3) {
      epQuals.forEach((q, i) => {
        out.push(`[${q.result === "Observed" ? "X" : " "}] ${q1Titles[i]}`);
        if (q.timestamps) out.push(`    Timestamps: ${q.timestamps}`);
        if (q.note) out.push(`    Note: ${q.note}`);
      });
    } else {
      out.push(`[${ep.icf_code_alignment === "Observed" ? "X" : " "}] ICF Code of Ethics alignment`);
      if (ep.icf_code_alignment_note) out.push(`    Note: ${ep.icf_code_alignment_note}`);
      out.push(`[${ep.coach_role_alignment === "Observed" ? "X" : " "}] Coach role alignment`);
      if (ep.coach_role_alignment_note) out.push(`    Note: ${ep.coach_role_alignment_note}`);
    }
    out.push("");

    const compTitles = { 3:"Establishes and Maintains Agreements", 4:"Cultivates Trust and Safety", 5:"Maintains Presence", 6:"Listens Actively", 7:"Evokes Awareness", 8:"Facilitates Client Growth" };
    const grouped = {};
    (evaluation.behavioral_statements || []).forEach(s => {
      const c = parseInt(s.code.replace(/^[A-Za-z]+/, '').split('.')[0], 10);
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

    // ── Colors ────────────────────────────────────────────────────────────
    const NAVY = [0, 32, 91];
    const MID_BLUE = [95, 145, 195];
    const WHITE = [255, 255, 255];
    const TEXT = [20, 20, 20];
    const TEXT_MID = [90, 90, 90];
    const ROW_ALT = [248, 249, 251];
    const BORDER = [195, 200, 210];
    const OBS_GREEN = [22, 163, 74];
    const NOT_OBS_RED = [185, 28, 28];

    // ── Layout ────────────────────────────────────────────────────────────
    const PW = 612, PH = 792;
    const MX = 36, MB = 42;
    const CW = PW - 2 * MX;   // 540
    const RC = 128;            // right column
    const LC = CW - RC;       // left column = 412
    let y = 0, pageNum = 0;

    const wrap = (text, width, size) => {
      doc.setFontSize(size);
      return doc.splitTextToSize(String(text || ""), width);
    };
    const LH = (sz) => sz * 1.4;

    const newPage = () => {
      if (pageNum > 0) doc.addPage();
      pageNum++;
      y = 44;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.setTextColor(...TEXT_MID);
      doc.text("CoachRICE: Level 1", MX, y); y += 12;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.setTextColor(...NAVY);
      doc.text("Associate Certified Coach (ACC) Observation Form", MX, y); y += 6;
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.75);
      doc.line(MX, y, PW - MX, y); y += 12;
    };

    const drawFooter = () => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text("Aligned to ICF Minimum Skills Requirements (2025)", MX, PH - 18);
      doc.setTextColor(...TEXT);
      doc.text(String(pageNum), PW / 2, PH - 18, { align: "center" });
    };

    const ensureSpace = (needed) => {
      if (y + needed > PH - MB - 20) { drawFooter(); newPage(); }
    };

    const drawCompHeader = (title, subtitle) => {
      doc.setFontSize(8);
      const subL = subtitle ? wrap(subtitle, CW - 16, 8) : [];
      const hH = 14 + (subL.length ? subL.length * LH(8) + 2 : 0) + 8;
      ensureSpace(hH + 44);
      doc.setFillColor(...NAVY);
      doc.rect(MX, y, CW, hH, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.setTextColor(...WHITE);
      doc.text(title, MX + 8, y + 13);
      if (subL.length) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.text(subL, MX + 8, y + 13 + LH(9.5));
      }
      y += hH;
    };

    const drawColHeader = (leftLabel) => {
      const rH = 22;
      doc.setFillColor(...MID_BLUE);
      doc.rect(MX, y, LC, rH, "F");
      doc.rect(MX + LC, y, RC, rH, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text(leftLabel, MX + 8, y + 14);
      doc.text("Observed/Not Observed", MX + LC + RC / 2, y + 14, { align: "center" });
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
      doc.rect(MX, y, CW, rH);
      doc.line(MX + LC, y, MX + LC, y + rH);
      y += rH;
    };

    const drawRow = (boldPrefix, bodyText, result, tsString, note, shade) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      const pfxW = boldPrefix ? doc.getTextWidth(boldPrefix + " ") : 0;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const bodyL = wrap(bodyText, LC - pfxW - 16, 9);
      doc.setFont("helvetica", "italic"); doc.setFontSize(8);
      const tsL = wrap(tsString || "Timestamps:", LC - 16, 8);
      const noteL = note ? wrap(note, LC - 16, 8) : [];
      const rH = Math.max(
        14 + bodyL.length * LH(9) + tsL.length * LH(8) + (noteL.length ? noteL.length * LH(8) + 3 : 0) + 8,
        40
      );
      ensureSpace(rH);
      doc.setFillColor(...(shade ? ROW_ALT : WHITE));
      doc.rect(MX, y, LC, rH, "F");
      doc.setFillColor(...WHITE);
      doc.rect(MX + LC, y, RC, rH, "F");
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
      doc.rect(MX, y, CW, rH);
      doc.line(MX + LC, y, MX + LC, y + rH);
      let tx = MX + 8, ty = y + 12;
      if (boldPrefix) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.setTextColor(...TEXT);
        doc.text(boldPrefix, tx, ty);
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(bodyL, tx + pfxW, ty);
      ty += bodyL.length * LH(9) + 2;
      doc.setFont("helvetica", "italic"); doc.setFontSize(8);
      doc.setTextColor(...TEXT_MID);
      doc.text(tsL, tx, ty);
      ty += tsL.length * LH(8);
      if (noteL.length) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.setTextColor(110, 110, 110);
        doc.text(noteL, tx, ty + 2);
      }
      if (result) {
        const isObs = result === "Observed";
        doc.setFont("helvetica", "bold"); doc.setFontSize(8);
        doc.setTextColor(...(isObs ? OBS_GREEN : NOT_OBS_RED));
        doc.text(result, MX + LC + RC / 2, y + rH / 2 + 3, { align: "center" });
      }
      y += rH;
    };

    // ════════════════════════════════════════════════════════════════════════
    newPage();

    // Coach / Assessor / Date header row
    const infoH = 26, thirds = CW / 3;
    doc.setFillColor(...NAVY);
    doc.rect(MX, y, CW, infoH, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE);
    doc.text("Coach:", MX + 8, y + 16);
    doc.text("Assessor:", MX + thirds + 8, y + 16);
    doc.text("Date:", MX + thirds * 2 + 8, y + 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const coachLW = doc.getTextWidth("Coach: ");
    const dateLW = doc.getTextWidth("Date: ");
    const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    doc.text(evaluation.coach_identifier || "Submitted Coach", MX + 8 + coachLW, y + 16);
    doc.text(dateStr, MX + thirds * 2 + 8 + dateLW, y + 16);
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
    doc.line(MX + thirds, y, MX + thirds, y + infoH);
    doc.line(MX + thirds * 2, y, MX + thirds * 2, y + infoH);
    doc.rect(MX, y, CW, infoH);
    y += infoH + 8;

    // ── COMPETENCY 1 ──────────────────────────────────────────────────────
    const ep = evaluation.ethical_practice || {};
    const qualifiers = ep.qualifiers || [];
    const q1Texts = [
      "Coach demonstrates a strong understanding and alignment with the ICF Code of Ethics.",
      "Coach consistently stays in the role of the coach, demonstrating knowledge of how to structure a coaching conversation and stays focused on future and present issues.",
      "Use key coaching skills such as trust, presence, active listening, and evoking awareness to facilitate the client's own insights."
    ];
    drawCompHeader("1. Demonstrates Ethical Practice", "Understands and consistently applies coaching ethics and standards of coaching.");
    drawColHeader("Qualifier");
    if (qualifiers.length === 3) {
      qualifiers.forEach((q, i) => {
        const tsStr = q.timestamps ? "Timestamps: " + q.timestamps : "Timestamps:";
        drawRow(String(i + 1) + ".", q1Texts[i], q.result, tsStr, q.note, i % 2 === 1);
      });
    } else {
      drawRow("1.", q1Texts[0], ep.icf_code_alignment || null, "Timestamps:", ep.icf_code_alignment_note, false);
      drawRow("2.", q1Texts[1], ep.coach_role_alignment || null, "Timestamps:", ep.coach_role_alignment_note, true);
      drawRow("3.", q1Texts[2], null, "Timestamps:", "", false);
    }
    y += 6;

    // ── COMPETENCY 2 ──────────────────────────────────────────────────────
    drawCompHeader("2. Embodies a Coaching Mindset", "Develops and maintains a mindset that is open, curious, flexible and client-centered.");
    const c2H = 34; ensureSpace(c2H);
    doc.setFillColor(...WHITE); doc.rect(MX, y, CW, c2H, "F");
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.5); doc.rect(MX, y, CW, c2H);
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...TEXT);
    doc.text("Candidates' understanding of this competency is evaluated in the ICF ACC Exam.", MX + 8, y + 20);
    y += c2H + 8;

    // ── COMPETENCIES 3-8 ─────────────────────────────────────────────────
    const grouped = {};
    (evaluation.behavioral_statements || []).forEach(s => {
      const c = parseInt(s.code.replace(/^[A-Za-z]+/, "").split(".")[0], 10);
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(s);
    });

    const compMeta = [
      { n: 3, name: "3. Establishes and Maintains Agreements", sub: "Partners with the client and relevant stakeholders to create clear agreements about the coaching relationship, process, plans and goals. Establishes agreements for the overall coaching engagement as well as those for each coaching session." },
      { n: 4, name: "4. Cultivates Trust and Safety", sub: "Partners with the client to create a safe, supportive environment that allows the client to share freely. Maintains a relationship of mutual respect and trust." },
      { n: 5, name: "5. Maintains Presence", sub: "Is fully conscious and present with the client, employing a style that is open, flexible, grounded and confident." },
      { n: 6, name: "6. Listens Actively", sub: "Focuses on what the client is and is not saying to fully understand what is being communicated in the context of the client systems and to support client self-expression." },
      { n: 7, name: "7. Evokes Awareness", sub: "Facilitates client insight and learning by using tools and techniques such as powerful questioning, silence, metaphor or analogy." },
      { n: 8, name: "8. Facilitates Client Growth", sub: "Partners with the client to transform learning and insight into action. Promotes client autonomy in the coaching process." },
    ];
    compMeta.forEach(comp => {
      drawCompHeader(comp.name, comp.sub);
      drawColHeader("Behavioral Statement");
      (grouped[comp.n] || []).forEach((s, i) => {
        const tsStr = s.evidence && s.evidence.length
          ? "Timestamps: " + s.evidence.map(e => e.timestamp).join("  ·  ")
          : "Timestamps:";
        drawRow(s.code, s.title, s.result, tsStr, s.note, i % 2 === 1);
      });
      y += 6;
    });

    drawFooter();

    // ── PAGE: Evaluation Evidence ─────────────────────────────────────────
    newPage();
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...TEXT);
    doc.text("Evaluation Evidence", MX, y);
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...TEXT_MID);
    doc.text("(Optional - Use to create final summary)", MX + doc.getTextWidth("Evaluation Evidence") + 6, y);
    y += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEXT_MID);
    doc.text("Include associated behavioral statements, timestamps and/or quotes.", MX, y);
    y += 11;

    const halfW = CW / 2;
    doc.setFillColor(...NAVY);
    doc.rect(MX, y, halfW, 24, "F");
    doc.rect(MX + halfW, y, halfW, 24, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE);
    doc.text("Evidence", MX + halfW / 2, y + 15, { align: "center" });
    doc.text("Contra-Evidence", MX + halfW + halfW / 2, y + 15, { align: "center" });
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
    doc.rect(MX, y, CW, 24); doc.line(MX + halfW, y, MX + halfW, y + 24);
    y += 24;

    const evLines = [], contraLines = [];
    (evaluation.behavioral_statements || []).forEach(s => {
      if (s.evidence && s.evidence.length) {
        const txt = "[" + s.code + "] " + s.evidence.map(e => e.timestamp + ': "' + e.quote + '"').join("; ");
        wrap(txt, halfW - 16, 8).forEach(l => evLines.push(l));
        evLines.push("");
      }
      if (s.contra_evidence) {
        const txt = "[" + s.code + "] " + s.contra_evidence;
        wrap(txt, halfW - 16, 8).forEach(l => contraLines.push(l));
        contraLines.push("");
      }
    });

    const evH = Math.max(evLines.length * LH(8), contraLines.length * LH(8), PH - MB - y - 30);
    doc.setFillColor(...WHITE);
    doc.rect(MX, y, CW, evH, "F");
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
    doc.rect(MX, y, CW, evH); doc.line(MX + halfW, y, MX + halfW, y + evH);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    if (evLines.length) doc.text(evLines, MX + 8, y + 12);
    doc.setTextColor(140, 80, 20);
    if (contraLines.length) doc.text(contraLines, MX + halfW + 8, y + 12);
    y += evH;
    drawFooter();

    // ── PAGE: Evaluation Summary ──────────────────────────────────────────
    newPage();
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...TEXT);
    doc.text("Evaluation Summary", MX, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEXT_MID);
    doc.text("(Required)", MX + doc.getTextWidth("Evaluation Summary") + 6, y);
    y += 11;

    const labelW = 148, summW = CW - labelW;
    doc.setFillColor(...NAVY);
    doc.rect(MX, y, labelW, 24, "F");
    doc.rect(MX + labelW, y, summW, 24, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE);
    doc.text("Summary", MX + labelW + summW / 2, y + 15, { align: "center" });
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
    doc.rect(MX, y, CW, 24); doc.line(MX + labelW, y, MX + labelW, y + 24);
    y += 24;

    const drawSummRow = (labelL1, labelL2, content) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const cL = wrap(content, summW - 16, 9);
      const rH = Math.max(cL.length * LH(9) + 20, 80);
      doc.setFillColor(...WHITE); doc.rect(MX, y, CW, rH, "F");
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
      doc.rect(MX, y, CW, rH); doc.line(MX + labelW, y, MX + labelW, y + rH);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...TEXT);
      const lMid = y + rH / 2;
      doc.text(labelL1, MX + labelW / 2, labelL2 ? lMid - 4 : lMid + 4, { align: "center" });
      if (labelL2) doc.text(labelL2, MX + labelW / 2, lMid + 10, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEXT);
      if (cL.length) doc.text(cL, MX + labelW + 8, y + 14);
      y += rH;
    };

    const strengthsText = (evaluation.strengths || []).map((s, i) =>
      (i + 1) + ". " + s.competency_name + " (" + s.code + "): " + s.explanation
    ).join("\n\n");
    const suggestionsText = (evaluation.suggestions || []).map((s, i) => {
      let t = (i + 1) + ". " + s.competency_name + " (" + s.code + "): " + s.missed_opportunity;
      if (s.example_prompts && s.example_prompts.length)
        t += "\nExample prompts: " + s.example_prompts.map(p => '"' + p + '"').join(" / ");
      return t;
    }).join("\n\n");

    drawSummRow("Coaching Competency", "Strengths", strengthsText || "—");
    drawSummRow("Suggestions for", "Competency Development", suggestionsText || "—");
    drawSummRow("Ethical Concerns", "(if any)", (evaluation.ethical_concerns && evaluation.ethical_concerns !== "None") ? evaluation.ethical_concerns : "None");
    drawFooter();

    // ── Output ────────────────────────────────────────────────────────────
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

            {/* Competency 1: Ethical Practice */}
            {(() => {
              const ep = evaluation.ethical_practice || {}
              const quals = ep.qualifiers || []
              const q1Labels = [
                'Coach demonstrates a strong understanding and alignment with the ICF Code of Ethics.',
                'Coach consistently stays in the role of the coach, demonstrating knowledge of how to structure a coaching conversation and stays focused on future and present issues.',
                'Coach uses key coaching skills such as trust, presence, active listening, and evoking awareness to facilitate the client\'s own insights.'
              ]
              const rows = quals.length === 3
                ? quals.map((q, i) => ({ label: q1Labels[i], result: q.result, timestamps: q.timestamps, note: q.note }))
                : [
                  { label: q1Labels[0], result: ep.icf_code_alignment, note: ep.icf_code_alignment_note },
                  { label: q1Labels[1], result: ep.coach_role_alignment, note: ep.coach_role_alignment_note },
                  { label: q1Labels[2], result: null, note: '' }
                ]
              return (
                <div style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: COLORS.navy, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    1. Demonstrates Ethical Practice
                  </h3>
                  {rows.map((row, i) => (
                    <div key={i} style={{ background: '#f9fafc', borderRadius: '8px', border: `1px solid ${COLORS['gray-border']}`, padding: '16px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: COLORS.navy }}>Qualifier {i + 1}</div>
                          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#1a1a1a', marginTop: '4px' }}>{row.label}</div>
                        </div>
                        {row.result && (
                          <span style={{ display: 'inline-block', padding: '4px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '4px', background: row.result === 'Observed' ? '#dcfce7' : '#fee2e2', color: row.result === 'Observed' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap', marginLeft: '12px', flexShrink: 0 }}>
                            {row.result === 'Observed' ? '✓ Observed' : '✗ Not Observed'}
                          </span>
                        )}
                      </div>
                      {row.timestamps && <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic' }}>Timestamps: {row.timestamps}</div>}
                      {row.note && <div style={{ fontSize: '12px', color: '#666', marginTop: '6px', fontStyle: 'italic' }}>{row.note}</div>}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Skills Observed */}
            <div style={{ marginBottom: '32px', padding: '16px', background: COLORS['gray-light'], borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: COLORS.gray, letterSpacing: '1px', marginBottom: '8px' }}>SKILLS OBSERVED (Competencies 3–8)</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: COLORS.navy }}>
                {(evaluation.behavioral_statements || []).filter(s => s.result === "Observed").length} / {evaluation.behavioral_statements?.length || 0}
              </div>
            </div>

            {/* Competencies 3-8 Grouped */}
            {(() => {
              const compTitles = { 3: 'Establishes and Maintains Agreements', 4: 'Cultivates Trust and Safety', 5: 'Maintains Presence', 6: 'Listens Actively', 7: 'Evokes Awareness', 8: 'Facilitates Client Growth' };
              const grouped = {};
              (evaluation.behavioral_statements || []).forEach(s => {
                const c = parseInt(s.code.replace(/^[A-Za-z]+/, '').split('.')[0], 10);
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
