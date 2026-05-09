import React, { useState, useRef, useEffect } from "react";
import Layout from "../../components/Layout";
import { supabase } from "../../lib/supabase";

// ============================================================================
// SYSTEM PROMPT — NOV 2025 BARS GUIDE (rev. 11.18.2025)
// ============================================================================
const DEFAULT_SYSTEM_PROMPT = `## ROLE

You are a calibrated ICF ACC assessor for the CoachRICE Level 1 program at the Doerr Institute for New Leaders. Your job is to evaluate a single coaching session transcript against the ICF Associate Certified Coach (ACC) Behaviorally Anchored Rating Scale (BARS) as defined in the ACC BARS Resource Guide (rev. 11.18.2025) and produce a complete CoachRICE Performance Evaluation, including a numerical score using the Doerr Institute Level 1 ACC Scoring Algorithm.

This evaluation is used to verify the calibration of human assessor reviews. Your output may be compared side-by-side with a human assessor's evaluation of the same session to identify whether the human rated too generously or too strictly. Your job is to be a strict, independent reader of the evidence — not to predict what a human assessor would say, and not to be lenient. Apply the BARS standards literally as written.

You produce assessor-grade output. You do not mentor coach. You do not give therapy-style interpretation. You do not invent evidence. Every rating you assign is anchored to a specific moment in the transcript that you can name.

## ABSOLUTE GROUND RULES

1. The ACC BARS Resource Guide (rev. 11.18.2025) is the only source of truth for the standard. The behavioral statement as written IS the standard for ACC level coaching. To meet the standard, the coach's behavior must reflect the elements described in the "Meets the Standard" section of each behavioral statement.
2. Evidence must be locatable. Every rating is supported by 2–4 specific timestamps from the transcript. If the transcript has no timestamps, cite the speaker turn (e.g., "Coach turn 14"). Each evidence entry includes a brief direct quote from the coach (under 15 words) that demonstrates the behavior.
3. No invention. If you cannot locate evidence in the transcript for a behavior, do not rate the coach as meeting it. Mark the rating "Below the Standard" or "Does Not Meet Standard," or, in rare cases where the conversation genuinely offered no opportunity, mark N/A and briefly explain why.
4. Stay in the assessor lane. Do not coach the coach in the per-skill body. Do not suggest what the coach should have said in the rating itself. Suggestions for development belong only in the final Suggestions section, and even there should be brief, evidence-anchored, and competency-anchored.
5. One transcript, one session. You assess only the session in front of you. Do not speculate about the coach's broader practice, intentions, training, or trajectory.
6. No mentor-coaching language. Avoid phrases like "the coach is developing…," "with more practice…," or "the growing edge here…." Use evaluator language: "the coach demonstrated…," "the coach did not demonstrate…," "the coach's question at 12:09 invited…."
7. Rate each behavior independently against the standard, not against a target distribution. The shape of the final evaluation must fall out of the evidence — do not aim for any particular mix of ratings. If a session genuinely warrants 18 "Meets the Standard" ratings, that is the answer. If a session genuinely warrants 12 "Below the Standard" ratings, that is the answer. Do not rate higher to balance the distribution; do not rate lower to balance the distribution.
8. Apply each rating threshold strictly. "Meets the Standard" requires the coach to demonstrate the behavior clearly AND with some consistency, in response to what the client presents — a single instance is not enough; consistency must be visible. "Exceeds the Standard" requires a higher level of coaching performance than would be expected for an entry-level coach — reserve this for behavior that is naturally and comfortably integrated into the conversation across the session and would stand out as a teaching example. When a behavior could plausibly be rated at two adjacent levels, choose the lower level and explain in the contra-evidence what would have been needed to reach the higher level.

## RATING SCALE (Nov 2025 BARS Guide)

| Rating | Nov 2025 BARS Description | Score (Doerr) |
|---|---|---|
| Exceeds the Standard | The coach demonstrates the behavior as described by the statement with a higher level of coaching performance than would be expected for an entry-level coach. | 5 |
| Meets the Standard | The coach demonstrates the behavior clearly and with some consistency as described by the statement. | 4 |
| Below the Standard | The coach demonstrates part of the behavior as described by the statement. | 2 |
| Does Not Meet Standard | The coach did not demonstrate the behavior as described by the statement. | 1 |
| N/A | The behavior was not relevant to the conversation or there were no opportunities for the coach to demonstrate it. | excluded from average |

### Special note on A8.1 (binary statement)

Per the Nov 2025 guide, A8.1 is a binary behavior: the coach either asks about the client's learning during the session, or does not. Do not rate A8.1 as "Below the Standard." Use only "Exceeds the Standard," "Meets the Standard," "Does Not Meet Standard," or N/A.

### How to apply the scale

- The Nov 2025 guide provides a clear "Meets the Standard" description for every behavioral statement, plus a "Below the Standard" example and a "Does Not Meet Standard" example. Compare the coach's behavior in the transcript to those descriptions. The closest match determines the rating.
- "Meets the Standard" is the ACC target. A competent ACC coach will land at "Meets" on most behaviors. The Nov 2025 guide describes this as demonstration "clearly and with some consistency."
- "Exceeds the Standard" requires more than repeated demonstration. It requires the behavior to perform at a level beyond what is expected of an entry-level ACC coach — naturally integrated, varied, and responsive to the moment.
- "Below the Standard" describes partial demonstration — the coach attempts the behavior but stops short of what's required (e.g., asks the topic but does not explore relevance; summarizes but does not confirm understanding).
- "Does Not Meet Standard" describes absence of the behavior or a directive/non-coaching substitute.

### Evidence requirements

Never rate "Exceeds the Standard" on vague evidence. "Throughout the session" is not adequate. Specific timestamps with direct quotes are required for every rating, and the bar rises with the rating:

- "Meets the Standard" requires clear demonstration with some consistency — at minimum two instances distributed across the session, or one extended instance that fully meets the description in "Meets the Standard."
- "Exceeds the Standard" requires evidence that the behavior is naturally and comfortably integrated, with at least three high-quality instances — including in the latter half of the session — that go beyond what an entry-level ACC coach would typically produce.
- "Below the Standard" requires at least one instance where the coach attempts the behavior but stops short of the standard.
- "Does Not Meet Standard" requires affirmative reasoning that the behavior is absent across the session.

Do not work backward from a target distribution. Whatever ratings the evidence supports is the correct answer.

## CALIBRATION ANCHORS (Nov 2025 BARS-grounded patterns)

### A3.1 — Coach explores the client's topic with the client.
- Meets: Coach invites the client to identify the topic AND clarifies aspects of client context, thinking, and purpose for the conversation.
- Below: Coach explores the topic but does not explore its relevance for the client.
- Does Not Meet: Coach does not explore the client's topic at all.

### A3.2 — Coach and client reach agreement on what the client wants to accomplish as a session outcome.
- Meets: Coach's restatement or summary reflects the client's chosen purpose AND the agreement is verbally confirmed by both participants.
- Below: Coach proceeds without confirming the outcome with the client.
- Does Not Meet: Coach does not inquire about the client's desired outcome.

### A3.3 — Coach explores the significance of the coaching outcome to the client.
- Meets: Coach's comments, reflections, and questions encourage the client to consider possible objective or subjective benefits of accomplishing the stated coaching session purpose.
- Below: Coach makes comments but does not inquire about how the outcome is important to the client.
- Does Not Meet: Coach listens without asking any questions about the importance of the outcome and proceeds with the session.

### A3.4 — Coach attends to the agreed upon agenda throughout the session.
- Meets: Coach demonstrates attention to the client's stated focus AND clarifies or realigns if the agenda shifts, throughout the session.
- Below: Coach attends to the agenda but does not clarify or realign when it shifts.
- Does Not Meet: Coach does not attend to the agreed upon agenda throughout the session.

### A4.1 — Coach acknowledges the client's work in the session.
- Meets: Coach verbally recognizes and reflects the SPECIFIC details of a client's insight, talents, or learning. Customized response, not generic.
- Below: Coach makes a generic comment about the client's insight, talents, or learning ("That's great," "Good awareness").
- Does Not Meet: Coach does not acknowledge the client's insight, talents, or learning.
- Distinction from A8.1: A4.1 is acknowledgement; A8.1 is asking questions about learning. The same question can serve as evidence for both, but evaluated through different competency lenses.

### A4.2 — Coach expresses respect, support, or concern for the client.
- Meets: Coach demonstrates respect for the client's autonomy and dignity AND provides a supportive space for the client to process.
- Below: Coach provides responses that demonstrate limited understanding of the client's perspective or expressions.
- Does Not Meet: Coach neglects opportunities to express understanding and support for the client.

### A4.3 — Coach supports the client's expression of feelings, perceptions, concerns, or beliefs.
- Meets: Coach uses questions, observations, or silence to support the client's processing of thoughts, feelings, perceptions, beliefs, or in-the-moment experiences.
- Below: Coach notices the client's offerings but does not respond to what the client expresses.
- Does Not Meet: Coach does not inquire about the client's feelings, perceptions, concerns, or beliefs.
- Distinction from A7.2: A4.3 supports/holds space; A7.2 inquires/explores. Same question can support both, evaluated through different competency lenses.

### A5.1 — Coach is observant and responsive to the client.
- Meets: Coach partners by staying in the moment, acknowledging verbal and nonverbal cues from the client and reflecting them back, responding with relevant questions or reflections, and following the client's lead.
- Below: Coach offers observations but does not explore further in response to what the client offers.
- Does Not Meet: Coach's questions and observations are not responsive to what the client offers.

### A5.2 — Coach demonstrates curiosity about the client, or their agenda, or both.
- Meets: Coach partners by asking open-ended questions centered on what the client wants to explore. Coach is curious in service of the client, the agenda, or both.
- Below: Coach offers questions without further exploration into the meaning of what the client shares.
- Does Not Meet: Coach doesn't engage in curious inquiry about what the client shares.

### A5.3 — Coach provides space for the client to lead during the session.
- Meets: Coach partners with the client, providing the opportunity to choose the topic, outcome, and path to follow for the conversation by being responsive and non-directive.
- Below: Coach initially allows the client to lead but then becomes directive as the session progresses.
- Does Not Meet: Coach directs the conversation.

### A5.4 — Coach is silent to allow time for the client to reflect.
- Meets: Coach partners by remaining silent after offering inquiries and pauses to give time for the client to think and respond throughout the session.
- Below: Coach offers space to reflect some of the time, but not consistently throughout the session.
- Does Not Meet: Coach does not give the client time to reflect after making an inquiry, offering an observation, or while the client is thinking.

### A6.1 — Coach listens by recognizing feelings, perceptions, challenges, or beliefs.
- Meets: Coach offers observations or shares insights they have observed or heard from the client, recognizing their perceptions, feelings, or challenges.
- Below: Coach misses some opportunities to recognize the client's feelings, perceptions, challenges, or beliefs.
- Does Not Meet: Coach does not recognize feelings, perceptions, challenges, or beliefs presented by the client.

### A6.2 — Coach inquires about, explores, or includes the client's use of language.
- Meets: Coach is curious about and integrates the client's words or thoughts into their inquiries or reflections.
- Below: Coach acknowledges the client's words but does not explore, inquire, or use the client's language.
- Does Not Meet: Coach does not ask about, comment on, or use the client's language.

### A6.3 — Coach summarizes or paraphrases what the client communicates to confirm the coach's understanding.
- Meets: Coach verifies their understanding of what the client offered by summarizing or paraphrasing what was shared.
- Below: Coach summarizes or paraphrases what the client offers but does not confirm understanding.
- Does Not Meet: Coach does not summarize or paraphrase what the client has said to ensure understanding.

### A7.1 — Coach supports the client in viewing the situation from different perspectives.
- Meets: Coach offers observations AND asks questions to support the client in seeing the situation from a new or different perspective.
- Below: Coach offers observations or questions but misses opportunities to engage the client in further developing a new or different perspective.
- Does Not Meet: There is no evidence of questions or observations offered to develop new or different perspectives.

### A7.2 — Coach inquires about the client's feelings, perceptions, behaviors, or beliefs.
- Meets: Coach asks questions to explore with the client their feelings, beliefs, perceptions, or behaviors in the session.
- Below: Coach makes inquiries but does not explore the client's feelings, perceptions, and beliefs beyond the client's response.
- Does Not Meet: Coach does not make inquiries that focus on the client's feelings, perceptions, behaviors, or beliefs.

### A7.3 — Coach asks clear, open-ended questions, one at a time.
- Meets: Coach asks clear, open-ended questions, one at a time, throughout the session.
- Below: Coach asks questions, but they may not be clear, open-ended, or asked one at a time.
- Does Not Meet: Coach primarily asks closed-ended questions or asks a series of questions without allowing the client time to answer.

### A8.1 — Coach asks questions about what the client has learned during the session. (BINARY)
- Meets: Coach asks the client about their learning during the session. Can occur at any time in the session.
- Does Not Meet: Coach does not ask about the client's learning OR offers their own perception of what the client learned without partnering with the client.
- Note: This statement is binary. There is no "Below the Standard" rating for A8.1. Use only Exceeds, Meets, Does Not Meet, or N/A.

### A8.2 — Coach supports the client to use their learning to plan next steps.
- Meets: Coach supports the client in exploring how they will apply their learning to specific, actionable steps.
- Below: Coach supports the client to create actionable steps, but they are not related to their learning.
- Does Not Meet: Coach does not support the client in exploring actionable steps.

### A8.3 — Coach supports the client to close the session.
- Meets: Coach supports the client to choose how AND when to end the session.
- Below: Coach offers to close the session but does not support the client in how or when to end.
- Does Not Meet: Coach closes the session abruptly.

## EVALUATION PROCEDURE

When a transcript is submitted, follow this procedure in order. Do not skip steps.

1. Read the full transcript end to end before rating anything. Form a holistic view first.
2. Identify candidate evidence for each behavioral statement.
3. Evaluate Competency 1 (Demonstrates Ethical Practice). Mark each of the two qualifiers as Observed or Not Observed. Default expectation: both are Observed. If a possible Code of Ethics breach is suspected, indicate the specific section of the Code that may apply.
4. Note Competency 2 (Embodies a Coaching Mindset): Per the Nov 2025 BARS Guide, Competency 2 is evaluated via the ICF ACC Exam, NOT via BARS in this performance assessment. Do not assign a BARS rating to Competency 2.
5. Evaluate each behavioral statement A3.1 through A8.3 (20 statements total). For each: state the rating, provide 2–4 specific timestamps from the transcript, and include a brief direct quote (under 15 words) for each timestamp. Accept whatever timestamp format the transcript uses — common formats include MM:SS, H:MM:SS, HH:MM:SS, with or without surrounding parentheses or brackets (e.g., "12:34", "(0:12 - 0:23)", "[1:05:42]", "00:08:15"). Preserve the format as it appears in the transcript when citing it. If a coach turn spans multiple seconds, you may use a range like "11:20-11:22". If the transcript has no timestamps at all, cite the speaker turn instead (e.g., "Coach turn 14").
6. Compile Evidence and Contra-Evidence. List supporting evidence by behavioral statement code. List contra-evidence ONLY for skills where it affected the rating.
7. Calculate the Score. Score values: Exceeds the Standard=5, Meets the Standard=4, Below the Standard=2, Does Not Meet Standard=1, N/A=excluded from average. Average within each competency (using only the rated statements; exclude N/A from the denominator). Average the six competency scores (3, 4, 5, 6, 7, 8) for the Total Raw Score. Final Score = (Raw − 1) × 2.5. Pass if Final Score ≥ 3.4.
8. Write the Evaluation Summary using only the ratings and evidence you have already produced in Steps 3–6. Do not re-evaluate the transcript. Do not introduce new observations or shift your interpretation. The summary must be derived from the work already done.

   **Selecting strengths (max 2):**
   - Eligible: only behavioral statements you rated **"Exceeds the Standard" or "Meets the Standard"** in Step 5.
   - Pick the two highest-rated skills. Ties broken by which one had the strongest, most varied evidence in Step 6.
   - The explanation must reference the specific timestamps and quotes you already cited for that skill — do not introduce new evidence.
   - If fewer than 2 skills meet the eligibility threshold, list however many qualify (1 or 0). Do not invent strengths.

   **Selecting suggestions (max 2) — use this exact algorithm:**

   *Step A: Identify the target competencies.*
   - Find the two lowest-scoring competencies among Comp 3, 4, 5, 6, 7, 8 using the competency averages computed in Step 7.
   - If two or more competencies are tied for the lowest average, break the tie by which one contains the lowest individual skill rating. If still tied, break by which competency has the most skills rated "Below the Standard" or "Does Not Meet Standard."

   *Step B: Within each target competency, pick the most foundational skill rated "Below the Standard" or "Does Not Meet Standard."*
   - Use the foundational ranking below (lower number = more foundational). Pick the highest-priority eligible skill in that competency.
   - If two skills within a competency are tied in foundational priority, the tie breaks first on the lower numeric rating ("Does Not Meet Standard" < "Below the Standard"), then on the weaker evidence (more contra-evidence or weaker positive evidence).

   *Foundational ranking within each competency (priority 1 = most foundational, must be addressed first):*
   - **Competency 3 — Establishes and Maintains Agreements**
     1. A3.1 — explores the client's topic
     2. A3.2 — agreement on session outcome
     3. A3.4 — attends to the agenda throughout
     4. A3.3 — explores significance of the outcome
   - **Competency 4 — Cultivates Trust and Safety**
     1. A4.1 AND A4.3 (tied — both foundational; tie breaks on lower rating, then weaker evidence)
     2. A4.2 — expresses respect, support, or concern
   - **Competency 5 — Maintains Presence**
     1. A5.3 — provides space for the client to lead
     2. A5.1 — observant and responsive
     3. A5.2 — curiosity about client/agenda
     4. A5.4 — silent for client reflection
   - **Competency 6 — Listens Actively**
     1. A6.1 — recognizing feelings, perceptions, challenges, beliefs
     2. A6.3 — summarizing/paraphrasing to confirm understanding
     3. A6.2 — inquires about/uses client's language
   - **Competency 7 — Evokes Awareness**
     1. A7.3 — clear, open-ended questions, one at a time
     2. A7.2 — inquires about feelings, perceptions, behaviors, beliefs
     3. A7.1 — supports new/different perspectives
   - **Competency 8 — Facilitates Client Growth**
     1. A8.1 — asks about client's learning (binary)
     2. A8.2 — supports learning into next steps
     3. A8.3 — supports the client to close the session

   *Step C: If both target competencies have eligible skills, your two suggestions are the foundational skill from each. If one of the lowest-scoring competencies has no skill rated "Below the Standard" or lower, drop that competency and move to the third-lowest. If the entire session is so strong that fewer than 2 skills total are rated "Below the Standard" or lower, list however many qualify (1 or 0). Do not invent suggestions.*

   *Step D: Format each suggestion.*
   - The "missed opportunity" sentence must reference the specific contra-evidence or absence-of-evidence you already cited for that skill in Step 6 — do not introduce new observations.
   - The example prompts must be brief, constructive coaching prompts the coach could have used at the moment you already identified — not new advice. Tone stays constructive, not punitive, even when the rating is harsh.

   **Selecting divergence flags (0–5):**
   - For each behavioral statement you already rated in Step 5, ask: would a typical human assessor likely read this same evidence differently? Flag only skills where the answer is yes.
   - Reference the rating you already assigned and the evidence you already cited. Do not change the rating.
   - The "reason" must explain why a human assessor reading the same evidence might land at the predicted alternate rating, grounded in the BARS criteria for that specific behavior.

   **Self-consistency check before finalizing:** Before producing the JSON, verify that (a) every strength references a skill rated "Meets the Standard" or higher; (b) every suggestion references a skill rated "Below the Standard" or lower; (c) every timestamp and quote in the summary appears in the per-skill evidence above; (d) no claim in the summary contradicts a rating or piece of evidence already cited; (e) A8.1 is not rated "Below the Standard." If any inconsistency exists, fix the summary, not the ratings.

## OUTPUT FORMAT

CRITICAL: You MUST respond with a single valid JSON object only. No prose before or after. No markdown code fences. The JSON must follow this exact schema:

{
  "coach_identifier": "string (from transcript or 'Submitted Coach')",
  "guide_version": "Nov 2025 (rev. 11.18.2025)",
  "ethical_practice": {
    "icf_code_alignment": "Observed" | "Not Observed",
    "icf_code_alignment_note": "string (only if Not Observed; otherwise empty string. Cite specific Code of Ethics section if applicable.)",
    "coach_role_alignment": "Observed" | "Not Observed",
    "coach_role_alignment_note": "string (only if Not Observed; otherwise empty string)"
  },
  "behavioral_statements": [
    {
      "code": "A3.1",
      "title": "Coach explores the client's topic with the client.",
      "rating": "Exceeds the Standard" | "Meets the Standard" | "Below the Standard" | "Does Not Meet Standard" | "N/A",
      "score": 5 | 4 | 2 | 1 | null,
      "evidence": [
        { "timestamp": "string", "quote": "brief quote under 15 words" }
      ],
      "contra_evidence": "string (only if it affected the rating; otherwise empty string)"
    }
    // ... continue for all 20 statements: A3.1, A3.2, A3.3, A3.4, A4.1, A4.2, A4.3, A5.1, A5.2, A5.3, A5.4, A6.1, A6.2, A6.3, A7.1, A7.2, A7.3, A8.1, A8.2, A8.3
  ],
  "score_calculation": {
    "competency_3_average": 0.00,
    "competency_4_average": 0.00,
    "competency_5_average": 0.00,
    "competency_6_average": 0.00,
    "competency_7_average": 0.00,
    "competency_8_average": 0.00,
    "raw_score": 0.00,
    "final_score": 0.00,
    "result": "Pass" | "Below Passing Standard"
  },
  "strengths": [
    {
      "competency_name": "string (e.g., 'Maintains Presence')",
      "code": "A5.1",
      "statement_title": "string",
      "explanation": "1–3 sentences grounded in BARS standard, with timestamps and brief quotes embedded"
    }
  ],
  "suggestions": [
    {
      "competency_name": "string",
      "code": "string",
      "statement_title": "string",
      "missed_opportunity": "1–2 sentence factual statement with timestamp",
      "example_prompts": ["example question 1", "example question 2"]
    }
  ],
  "divergence_flags": [
    {
      "code": "string (e.g., 'A4.1')",
      "ai_rating": "string (the rating you assigned)",
      "likely_human_rating": "string (what a typical human assessor would likely assign)",
      "direction": "AI rated lower" | "AI rated higher",
      "reason": "1–2 sentences explaining why a human assessor might read this differently. Reference the specific evidence and the BARS criterion that creates the disagreement."
    }
  ],
  "ethical_concerns": "None" | "string describing concern with Code of Ethics section"
}

The 20 behavioral_statements MUST appear in this exact order and use these exact codes and titles:
- A3.1: "Coach explores the client's topic with the client."
- A3.2: "Coach and client reach agreement on what the client wants to accomplish as a session outcome."
- A3.3: "Coach explores the significance of the coaching outcome to the client."
- A3.4: "Coach attends to the agreed upon agenda throughout the session."
- A4.1: "Coach acknowledges the client's work in the session."
- A4.2: "Coach expresses respect, support, or concern for the client."
- A4.3: "Coach supports the client's expression of feelings, perceptions, concerns, or beliefs."
- A5.1: "Coach is observant and responsive to the client."
- A5.2: "Coach demonstrates curiosity about the client, or their agenda, or both."
- A5.3: "Coach provides space for the client to lead during the session."
- A5.4: "Coach is silent to allow time for the client to reflect."
- A6.1: "Coach listens by recognizing feelings, perceptions, challenges, or beliefs."
- A6.2: "Coach inquires about, explores, or includes the client's use of language."
- A6.3: "Coach summarizes or paraphrases what the client communicates to confirm the coach's understanding."
- A7.1: "Coach supports the client in viewing the situation from different perspectives."
- A7.2: "Coach inquires about the client's feelings, perceptions, behaviors, or beliefs."
- A7.3: "Coach asks clear, open-ended questions, one at a time."
- A8.1: "Coach asks questions about what the client has learned during the session."
- A8.2: "Coach supports the client to use their learning to plan next steps."
- A8.3: "Coach supports the client to close the session."

Calculate competency averages and final score yourself. Round all numerical values to 2 decimal places. Pass threshold is final_score ≥ 3.4. Reminder: A8.1 is binary — do not assign "Below the Standard" to it. N/A ratings are excluded from competency averages.`;

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
        }
        if (map.ai_assessor_2025_prompt) {
          setSystemPrompt(map.ai_assessor_2025_prompt)
        } else {
          // Fallback to embedded default prompt if not configured in Supabase
          setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
        }
      } else {
        // If no config data, use default
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
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
      // Cached input reads are billed at $0.50/MTok and cache writes at $6.25/MTok if those fields appear.
      if (data.usage) {
        const inputTokens = data.usage.input_tokens || 0;
        const outputTokens = data.usage.output_tokens || 0;
        const cacheReadTokens = data.usage.cache_read_input_tokens || 0;
        const cacheCreateTokens = data.usage.cache_creation_input_tokens || 0;
        const cost =
          (inputTokens * 5 / 1_000_000) +
          (outputTokens * 25 / 1_000_000) +
          (cacheReadTokens * 0.5 / 1_000_000) +
          (cacheCreateTokens * 6.25 / 1_000_000);
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

  // Plain text download — guaranteed to work because Blob + anchor download
  // is permitted under the artifact CSP. Use this as the reliable fallback.
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

    const HR = "=".repeat(78);
    const SUB = "-".repeat(78);
    const out = [];

    out.push(HR);
    out.push("DOERR INSTITUTE FOR NEW LEADERS  |  COACHRICE LEVEL 1");
    out.push("ACC PERFORMANCE EVALUATION");
    out.push(HR);
    out.push("");
    out.push(`Coach:   ${evaluation.coach_identifier || "Submitted Coach"}`);
    out.push(`Date:    ${dateStr}`);
    out.push(`Rubric:  ICF ACC BARS (Nov 2025)`);
    out.push("");
    out.push(HR);
    out.push("FINAL SCORE");
    out.push(HR);
    out.push("");
    out.push(`  Final Score:      ${sc.final_score !== undefined ? sc.final_score.toFixed(2) : "—"}`);
    out.push(`  Pass threshold:   3.40`);
    out.push(`  Result:           ${sc.result || "—"}`);
    out.push("");
    out.push(HR);
    out.push("1. DEMONSTRATES ETHICAL PRACTICE");
    out.push("Understands and consistently applies coaching ethics and standards of coaching.");
    out.push(HR);
    out.push("");
    out.push(`  [${ep.icf_code_alignment === "Observed" ? "X" : " "}] Coach demonstrates alignment with the ICF Code of Ethics.`);
    if (ep.icf_code_alignment_note) {
      out.push(`      Note: ${ep.icf_code_alignment_note}`);
    }
    out.push(`  [${ep.coach_role_alignment === "Observed" ? "X" : " "}] Coach demonstrates consistent alignment with the role of "coach."`);
    if (ep.coach_role_alignment_note) {
      out.push(`      Note: ${ep.coach_role_alignment_note}`);
    }
    out.push("");

    out.push(HR);
    out.push("2. EMBODIES A COACHING MINDSET");
    out.push("Develops and maintains a mindset that is open, curious, flexible and client-centered.");
    out.push(HR);
    out.push("");
    out.push("  There are no Behavioral Statements for Competency 2 in the ACC BARS system.");
    out.push("  Candidates are assessed on their knowledge of and ability to apply Competency 2");
    out.push("  as part of the ICF Credentialing Exam.");
    out.push("");

    [3, 4, 5, 6, 7, 8].forEach((compNum) => {
      const compAvg = sc[`competency_${compNum}_average`];
      out.push(HR);
      const avgStr = compAvg !== undefined ? `  [Avg: ${compAvg.toFixed(2)}]` : "";
      out.push(`${compNum}. ${competencyTitles[compNum].toUpperCase()}${avgStr}`);
      out.push(HR);
      out.push("");

      (grouped[compNum] || []).forEach((s) => {
        out.push(`  ${s.code}  ${s.title}`);
        out.push(`        Rating: ${s.rating}`);
        if (s.evidence && s.evidence.length) {
          out.push(`        Evidence:`);
          s.evidence.forEach((e) => {
            out.push(`          - ${e.timestamp}  "${e.quote}"`);
          });
        }
        if (s.contra_evidence) {
          out.push(`        Contra-Evidence: ${s.contra_evidence}`);
        }
        out.push("");
      });
    });

    out.push(HR);
    out.push("SCORE CALCULATION");
    out.push(HR);
    out.push("");
    [3, 4, 5, 6, 7, 8].forEach((n) => {
      const avg = sc[`competency_${n}_average`];
      const title = competencyTitles[n];
      const padded = `${n}. ${title}`.padEnd(56, " ");
      out.push(`  ${padded}${avg !== undefined ? avg.toFixed(2) : "—"}`);
    });
    out.push("");
    out.push(SUB);
    out.push(`  Total Raw Score (avg of competency averages):     ${sc.raw_score !== undefined ? sc.raw_score.toFixed(2) : "—"}`);
    out.push(`  Final Score = (Raw - 1) x 2:                      ${sc.final_score !== undefined ? sc.final_score.toFixed(2) : "—"}`);
    out.push(`  Result:                                           ${sc.result || "—"}`);
    out.push("");

    out.push(HR);
    out.push("COACHING COMPETENCY STRENGTHS");
    out.push(HR);
    out.push("");
    (evaluation.strengths || []).forEach((s, idx) => {
      out.push(`  STRENGTH ${idx + 1} — ${s.competency_name} | ${s.code}`);
      out.push(`  ${s.statement_title}`);
      out.push("");
      const wrapped = wrapText(s.explanation, 74, "  ");
      out.push(wrapped);
      out.push("");
    });

    out.push(HR);
    out.push("SUGGESTIONS FOR COMPETENCY DEVELOPMENT");
    out.push(HR);
    out.push("");
    (evaluation.suggestions || []).forEach((s, idx) => {
      out.push(`  SUGGESTION ${idx + 1} — ${s.competency_name} | ${s.code}`);
      out.push(`  ${s.statement_title}`);
      out.push("");
      out.push(wrapText(s.missed_opportunity, 74, "  "));
      if (s.example_prompts && s.example_prompts.length) {
        out.push("");
        out.push(`  Example prompts the coach could have used:`);
        s.example_prompts.forEach((p) => {
          out.push(`    - "${p}"`);
        });
      }
      out.push("");
    });

    out.push(HR);
    out.push("CALIBRATION DIVERGENCE FLAGS");
    out.push(HR);
    out.push("");
    if (evaluation.divergence_flags && evaluation.divergence_flags.length > 0) {
      out.push("  Skills where this AI assessor's strict read may differ from a typical");
      out.push("  human assessor's read. Use these as comparison points when reviewing");
      out.push("  a human assessor's evaluation.");
      out.push("");
      evaluation.divergence_flags.forEach((d, idx) => {
        out.push(`  ${idx + 1}. ${d.code}  (AI: ${d.ai_rating}  |  Likely human: ${d.likely_human_rating})`);
        const arrow = d.direction === "AI rated lower" ? "AI is stricter" : "AI is more generous";
        out.push(`     [${arrow}]`);
        out.push(wrapText(d.reason, 72, "     "));
        out.push("");
      });
    } else {
      out.push("  No flags. The AI's read is expected to align with a typical human assessor's read.");
      out.push("");
    }

    out.push(HR);
    out.push("ETHICAL CONCERNS");
    out.push(HR);
    out.push("");
    out.push(`  ${evaluation.ethical_concerns || "None"}`);
    out.push("");
    out.push(HR);
    out.push("Generated by the CoachRICE ICF ACC Assessor");
    out.push("Calibrated to ICF ACC BARS (Nov 2025)");
    out.push(HR);

    const text = out.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const filename = `${customDownloadFilename}.txt`;

    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  };

  // Simple word-wrap helper for the text export
  const wrapText = (str, width, indent = "") => {
    if (!str) return "";
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = indent;
    words.forEach((w) => {
      if ((line + (line === indent ? "" : " ") + w).length > width) {
        lines.push(line);
        line = indent + w;
      } else {
        line = line === indent ? line + w : line + " " + w;
      }
    });
    if (line.trim()) lines.push(line);
    return lines.join("\n");
  };

  const doDownloadPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });

    // Doerr brand colors as RGB
    const NAVY = [0, 32, 91];
    const ORANGE = [255, 130, 0];
    const GRAY = [124, 126, 127];
    const LIGHT_GRAY = [229, 231, 235];
    const SAGE = [201, 214, 71];
    const SOFT_BLUE = [120, 179, 224];
    const SKY_BLUE = [105, 204, 230];
    const TEXT = [26, 26, 26];
    const PASS_GREEN = [22, 163, 74];
    const FAIL_RED = [220, 38, 38];

    const PAGE_W = 612;
    const PAGE_H = 792;
    const MARGIN_X = 54;
    const MARGIN_TOP = 60;
    const MARGIN_BOTTOM = 60;
    const CONTENT_W = PAGE_W - MARGIN_X * 2;

    let y = MARGIN_TOP;

    const ratingColor = (rating) => {
      if (rating === "Exemplary" || rating === "Extremely Proficient") return SKY_BLUE;
      if (rating === "Proficient") return SAGE;
      if (rating === "Sufficient") return [252, 211, 77];
      return [252, 165, 165];
    };

    const ensureSpace = (needed) => {
      if (y + needed > PAGE_H - MARGIN_BOTTOM) {
        doc.addPage();
        y = MARGIN_TOP;
      }
    };

    // ---- Header (first page only) ----
    const drawCoverHeader = () => {
      // Navy bar
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, PAGE_W, 6, "F");
      // Orange accent
      doc.setFillColor(...ORANGE);
      doc.rect(0, 6, PAGE_W, 3, "F");

      y = MARGIN_TOP + 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text("DOERR INSTITUTE FOR NEW LEADERS  ·  COACHRICE LEVEL 1", MARGIN_X, y);
      y += 22;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...NAVY);
      doc.text("ACC Performance Evaluation", MARGIN_X, y);
      y += 22;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...GRAY);
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      doc.text(`Coach: ${evaluation.coach_identifier || "Submitted Coach"}`, MARGIN_X, y);
      doc.text(`Date: ${dateStr}`, MARGIN_X + 220, y);
      doc.text(`Rubric: ICF ACC BARS (Nov 2025)`, MARGIN_X + 380, y);
      y += 18;

      doc.setDrawColor(...NAVY);
      doc.setLineWidth(2);
      doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      y += 24;
    };

    // ---- Score Box ----
    const drawScoreBox = () => {
      ensureSpace(90);
      const sc = evaluation.score_calculation || {};
      const isPass = sc.result === "Pass";
      const bgColor = isPass ? [240, 253, 244] : [254, 242, 242];
      const borderColor = isPass ? [134, 239, 172] : [252, 165, 165];

      doc.setFillColor(...bgColor);
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(1.5);
      doc.roundedRect(MARGIN_X, y, CONTENT_W, 80, 6, 6, "FD");

      // Final score label + value
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text("FINAL SCORE", MARGIN_X + 20, y + 22);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.setTextColor(...NAVY);
      doc.text(String((sc.final_score ?? 0).toFixed(2)), MARGIN_X + 20, y + 58);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text("Pass threshold: 3.40", MARGIN_X + 20, y + 72);

      // Pass / Fail badge
      const badgeColor = isPass ? PASS_GREEN : FAIL_RED;
      const badgeText = isPass ? "PASS" : "BELOW PASSING";
      const badgeW = isPass ? 80 : 140;
      doc.setFillColor(...badgeColor);
      doc.roundedRect(PAGE_W - MARGIN_X - badgeW - 16, y + 28, badgeW, 28, 4, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, PAGE_W - MARGIN_X - badgeW / 2 - 16, y + 46, { align: "center" });

      y += 100;
    };

    // ---- Section title ----
    const drawSectionTitle = (title, subtitle = null, rightLabel = null) => {
      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...NAVY);
      doc.text(title, MARGIN_X, y);
      if (rightLabel) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...GRAY);
        doc.text(rightLabel, PAGE_W - MARGIN_X, y, { align: "right" });
      }
      y += 12;
      if (subtitle) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...GRAY);
        const lines = doc.splitTextToSize(subtitle, CONTENT_W);
        doc.text(lines, MARGIN_X, y);
        y += lines.length * 11;
      }
      doc.setDrawColor(...LIGHT_GRAY);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      y += 14;
    };

    // ---- Ethical Practice Table ----
    const drawEthicalPractice = () => {
      drawSectionTitle("1. Demonstrates Ethical Practice", "Understands and consistently applies coaching ethics and standards of coaching.");

      const ep = evaluation.ethical_practice || {};
      const rows = [
        ["1. Coach demonstrates alignment with the ICF Code of Ethics.", ep.icf_code_alignment || ""],
        ["2. Coach demonstrates consistent alignment with the role of \"coach.\"", ep.coach_role_alignment || ""],
      ];

      // Header
      ensureSpace(24);
      doc.setFillColor(...NAVY);
      doc.rect(MARGIN_X, y, CONTENT_W, 22, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("QUALIFIER", MARGIN_X + 10, y + 14);
      doc.text("OBSERVED", PAGE_W - MARGIN_X - 10, y + 14, { align: "right" });
      y += 22;

      // Rows
      rows.forEach(([qualifier, observed]) => {
        ensureSpace(28);
        doc.setFillColor(255, 255, 255);
        doc.rect(MARGIN_X, y, CONTENT_W, 26, "F");
        doc.setDrawColor(...LIGHT_GRAY);
        doc.line(MARGIN_X, y + 26, PAGE_W - MARGIN_X, y + 26);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT);
        const qLines = doc.splitTextToSize(qualifier, CONTENT_W - 130);
        doc.text(qLines, MARGIN_X + 10, y + 16);

        const obsColor = observed === "Observed" ? PASS_GREEN : FAIL_RED;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...obsColor);
        doc.text(observed, PAGE_W - MARGIN_X - 10, y + 16, { align: "right" });

        y += 26;
      });
      y += 14;

      // Optional notes
      if (ep.icf_code_alignment_note) {
        ensureSpace(40);
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(252, 165, 165);
        const noteLines = doc.splitTextToSize(`Code of Ethics note: ${ep.icf_code_alignment_note}`, CONTENT_W - 20);
        const h = noteLines.length * 11 + 14;
        doc.roundedRect(MARGIN_X, y, CONTENT_W, h, 4, 4, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(153, 27, 27);
        doc.text(noteLines, MARGIN_X + 10, y + 12);
        y += h + 8;
      }
      if (ep.coach_role_alignment_note) {
        ensureSpace(40);
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(252, 165, 165);
        const noteLines = doc.splitTextToSize(`Coach role note: ${ep.coach_role_alignment_note}`, CONTENT_W - 20);
        const h = noteLines.length * 11 + 14;
        doc.roundedRect(MARGIN_X, y, CONTENT_W, h, 4, 4, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(153, 27, 27);
        doc.text(noteLines, MARGIN_X + 10, y + 12);
        y += h + 8;
      }
      y += 8;
    };

    // ---- Competency 2 ----
    const drawCompetency2 = () => {
      drawSectionTitle("2. Embodies a Coaching Mindset", "Develops and maintains a mindset that is open, curious, flexible and client-centered.");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      const text = "There are no Behavioral Statements for Competency 2 in the ACC BARS system. Candidates are assessed on their knowledge of and ability to apply Competency 2 as part of the ICF Credentialing Exam.";
      const lines = doc.splitTextToSize(text, CONTENT_W);
      ensureSpace(lines.length * 11 + 16);
      doc.text(lines, MARGIN_X, y);
      y += lines.length * 11 + 16;
    };

    // ---- Competencies 3-8 ----
    const drawBehavioralStatements = () => {
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

      [3, 4, 5, 6, 7, 8].forEach((compNum) => {
        const compAvg = evaluation.score_calculation?.[`competency_${compNum}_average`];
        drawSectionTitle(
          `${compNum}. ${competencyTitles[compNum]}`,
          null,
          compAvg !== undefined ? `Avg: ${compAvg.toFixed(2)}` : null
        );

        const statements = grouped[compNum] || [];
        statements.forEach((s) => {
          // Estimate height needed
          const titleLines = doc.splitTextToSize(s.title, CONTENT_W - 140);
          const evidenceText = (s.evidence || []).map(e => `${e.timestamp} "${e.quote}"`).join("  ·  ");
          const evidenceLines = doc.splitTextToSize(`EVIDENCE: ${evidenceText}`, CONTENT_W - 20);
          const contraLines = s.contra_evidence
            ? doc.splitTextToSize(`CONTRA: ${s.contra_evidence}`, CONTENT_W - 20)
            : [];
          const totalH = 16 + titleLines.length * 11 + 8 + evidenceLines.length * 11 + (contraLines.length ? contraLines.length * 11 + 6 : 0) + 14;
          ensureSpace(totalH);

          // Code + title
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...NAVY);
          doc.text(s.code, MARGIN_X, y + 12);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(...TEXT);
          doc.text(titleLines, MARGIN_X + 32, y + 12);

          // Rating chip on right
          const chipColor = ratingColor(s.rating);
          const chipText = s.rating || "—";
          const chipW = doc.getTextWidth(chipText) + 16;
          doc.setFillColor(...chipColor);
          doc.roundedRect(PAGE_W - MARGIN_X - chipW, y + 2, chipW, 16, 3, 3, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...NAVY);
          doc.text(chipText.toUpperCase(), PAGE_W - MARGIN_X - chipW / 2, y + 13, { align: "center" });

          y += Math.max(titleLines.length * 11 + 10, 22);

          // Evidence row
          doc.setFillColor(247, 248, 250);
          const evH = evidenceLines.length * 11 + (contraLines.length ? contraLines.length * 11 + 8 : 0) + 12;
          doc.rect(MARGIN_X, y, CONTENT_W, evH, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...TEXT);
          doc.text(evidenceLines, MARGIN_X + 10, y + 12);

          if (contraLines.length) {
            const contraY = y + 12 + evidenceLines.length * 11 + 4;
            doc.setDrawColor(...LIGHT_GRAY);
            doc.setLineDashPattern([2, 2], 0);
            doc.line(MARGIN_X + 10, contraY - 2, PAGE_W - MARGIN_X - 10, contraY - 2);
            doc.setLineDashPattern([], 0);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(153, 27, 27);
            doc.text(contraLines, MARGIN_X + 10, contraY + 8);
          }

          y += evH + 8;
        });

        y += 8;
      });
    };

    // ---- Score Calculation Table ----
    const drawScoreCalculation = () => {
      drawSectionTitle("Score Calculation");

      const competencyTitles = {
        3: "Establishes and Maintains Agreements",
        4: "Cultivates Trust and Safety",
        5: "Maintains Presence",
        6: "Listens Actively",
        7: "Evokes Awareness",
        8: "Facilitates Client Growth",
      };
      const sc = evaluation.score_calculation || {};

      ensureSpace(24);
      doc.setFillColor(...NAVY);
      doc.rect(MARGIN_X, y, CONTENT_W, 22, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("COMPETENCY", MARGIN_X + 10, y + 14);
      doc.text("AVERAGE", PAGE_W - MARGIN_X - 10, y + 14, { align: "right" });
      y += 22;

      [3, 4, 5, 6, 7, 8].forEach((n, idx) => {
        ensureSpace(22);
        doc.setFillColor(255, 255, 255);
        doc.rect(MARGIN_X, y, CONTENT_W, 20, "F");
        if (idx > 0) {
          doc.setDrawColor(...LIGHT_GRAY);
          doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT);
        doc.text(`${n}. ${competencyTitles[n]}`, MARGIN_X + 10, y + 13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...NAVY);
        const avg = sc[`competency_${n}_average`];
        doc.text(avg !== undefined ? avg.toFixed(2) : "—", PAGE_W - MARGIN_X - 10, y + 13, { align: "right" });
        y += 20;
      });

      // Raw score row
      ensureSpace(26);
      doc.setFillColor(247, 248, 250);
      doc.rect(MARGIN_X, y, CONTENT_W, 24, "F");
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(1.5);
      doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text("Total Raw Score (avg of competency averages)", MARGIN_X + 10, y + 15);
      doc.text(sc.raw_score !== undefined ? sc.raw_score.toFixed(2) : "—", PAGE_W - MARGIN_X - 10, y + 15, { align: "right" });
      y += 24;

      // Final score row
      ensureSpace(28);
      doc.setFillColor(...NAVY);
      doc.rect(MARGIN_X, y, CONTENT_W, 26, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("Final Score = (Raw − 1) × 2", MARGIN_X + 10, y + 17);
      doc.setFontSize(13);
      doc.text(sc.final_score !== undefined ? sc.final_score.toFixed(2) : "—", PAGE_W - MARGIN_X - 10, y + 18, { align: "right" });
      y += 32;
    };

    // ---- Strengths ----
    const drawStrengths = () => {
      drawSectionTitle("Coaching Competency Strengths");
      (evaluation.strengths || []).forEach((s) => {
        const explLines = doc.splitTextToSize(s.explanation || "", CONTENT_W - 24);
        const cardH = explLines.length * 11 + 50;
        ensureSpace(cardH);

        // Card with sage left border
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...LIGHT_GRAY);
        doc.rect(MARGIN_X, y, CONTENT_W, cardH, "FD");
        doc.setFillColor(...SAGE);
        doc.rect(MARGIN_X, y, 4, cardH, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(`${(s.competency_name || "").toUpperCase()}  ·  ${s.code}`, MARGIN_X + 16, y + 14);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...NAVY);
        const titleLines = doc.splitTextToSize(s.statement_title || "", CONTENT_W - 24);
        doc.text(titleLines, MARGIN_X + 16, y + 28);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT);
        const explY = y + 28 + titleLines.length * 11 + 4;
        doc.text(explLines, MARGIN_X + 16, explY);

        y += cardH + 10;
      });
    };

    // ---- Suggestions ----
    const drawSuggestions = () => {
      drawSectionTitle("Suggestions for Competency Development");
      (evaluation.suggestions || []).forEach((s) => {
        const moLines = doc.splitTextToSize(s.missed_opportunity || "", CONTENT_W - 24);
        const promptLines = (s.example_prompts || []).map(p => `• "${p}"`);
        const promptWrappedLines = promptLines.flatMap(p => doc.splitTextToSize(p, CONTENT_W - 28));
        const cardH = moLines.length * 11 + (promptWrappedLines.length ? promptWrappedLines.length * 11 + 22 : 0) + 50;
        ensureSpace(cardH);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...LIGHT_GRAY);
        doc.rect(MARGIN_X, y, CONTENT_W, cardH, "FD");
        doc.setFillColor(...SOFT_BLUE);
        doc.rect(MARGIN_X, y, 4, cardH, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(`${(s.competency_name || "").toUpperCase()}  ·  ${s.code}`, MARGIN_X + 16, y + 14);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...NAVY);
        const titleLines = doc.splitTextToSize(s.statement_title || "", CONTENT_W - 24);
        doc.text(titleLines, MARGIN_X + 16, y + 28);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT);
        const moY = y + 28 + titleLines.length * 11 + 4;
        doc.text(moLines, MARGIN_X + 16, moY);

        if (promptWrappedLines.length) {
          const pY = moY + moLines.length * 11 + 10;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...NAVY);
          doc.text("Example prompts the coach could have used:", MARGIN_X + 16, pY);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(...GRAY);
          doc.text(promptWrappedLines, MARGIN_X + 20, pY + 12);
        }

        y += cardH + 10;
      });
    };

    // ---- Divergence Flags ----
    const drawDivergenceFlags = () => {
      const flags = evaluation.divergence_flags || [];
      drawSectionTitle(
        "Calibration Divergence Flags",
        "Skills where this AI assessor's strict read may differ from a typical human assessor's read."
      );

      if (flags.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...GRAY);
        const text = "No flags. The AI's read is expected to align with a typical human assessor's read.";
        const lines = doc.splitTextToSize(text, CONTENT_W);
        ensureSpace(lines.length * 11 + 16);
        doc.text(lines, MARGIN_X, y);
        y += lines.length * 11 + 16;
        return;
      }

      flags.forEach((d) => {
        const reasonLines = doc.splitTextToSize(d.reason || "", CONTENT_W - 24);
        const cardH = reasonLines.length * 11 + 56;
        ensureSpace(cardH);

        // Card with orange left border (visual flag indicator)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...LIGHT_GRAY);
        doc.rect(MARGIN_X, y, CONTENT_W, cardH, "FD");
        doc.setFillColor(...ORANGE);
        doc.rect(MARGIN_X, y, 4, cardH, "F");

        // Code + direction tag
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...NAVY);
        doc.text(d.code, MARGIN_X + 16, y + 16);

        const arrowText = d.direction === "AI rated lower" ? "AI IS STRICTER" : "AI IS MORE GENEROUS";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(arrowText, PAGE_W - MARGIN_X - 16, y + 16, { align: "right" });

        // AI Read | Human Read
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...TEXT);
        doc.text(`AI read: `, MARGIN_X + 16, y + 32);
        doc.setFont("helvetica", "bold");
        doc.text(d.ai_rating || "", MARGIN_X + 56, y + 32);

        doc.setFont("helvetica", "normal");
        doc.text(`Likely human read: `, MARGIN_X + 200, y + 32);
        doc.setFont("helvetica", "bold");
        doc.text(d.likely_human_rating || "", MARGIN_X + 296, y + 32);

        // Reason
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT);
        doc.text(reasonLines, MARGIN_X + 16, y + 46);

        y += cardH + 10;
      });
    };

    // ---- Ethical Concerns ----
    const drawEthicalConcerns = () => {
      drawSectionTitle("Ethical Concerns");
      const text = evaluation.ethical_concerns || "None";
      const lines = doc.splitTextToSize(text, CONTENT_W);
      ensureSpace(lines.length * 11 + 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (text === "None") {
        doc.setTextColor(...GRAY);
      } else {
        doc.setTextColor(153, 27, 27);
      }
      doc.text(lines, MARGIN_X, y);
      y += lines.length * 11 + 16;
    };

    // ---- Page footer (added to every page at end) ----
    const addFooters = () => {
      const total = doc.internal.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(...LIGHT_GRAY);
        doc.setLineWidth(0.5);
        doc.line(MARGIN_X, PAGE_H - 38, PAGE_W - MARGIN_X, PAGE_H - 38);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(
          "GENERATED BY THE COACHRICE ICF ACC ASSESSOR  ·  DOERR INSTITUTE FOR NEW LEADERS  ·  CALIBRATED TO ICF BARS NOV 2025",
          PAGE_W / 2,
          PAGE_H - 26,
          { align: "center" }
        );
        doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN_X, PAGE_H - 26, { align: "right" });
      }
    };

    // ---- Build the document ----
    drawCoverHeader();
    drawScoreBox();
    drawEthicalPractice();
    drawCompetency2();
    drawBehavioralStatements();
    drawScoreCalculation();
    drawStrengths();
    drawSuggestions();
    drawDivergenceFlags();
    drawEthicalConcerns();
    addFooters();

    const filename = `${customDownloadFilename}.pdf`;

    // CSP-safe download: build a Blob and trigger via an anchor tag.
    // doc.save() internally creates a frame, which is blocked by the artifact's
    // Content Security Policy. The Blob + <a download> path is allowed.
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Free the Blob URL after the browser has had a moment to start the download
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  };

  const reset = () => {
    setStage("input");
    setTranscript("");
    setFilename("");
    setCustomDownloadFilename("");
    setEvaluation(null);
    setError("");
  };

  // ============================================================================
  // SCORE RECALCULATION
  // The model sometimes makes arithmetic errors on the fly. We recompute every
  // average and the final score from the per-statement ratings ourselves, so
  // the displayed math is always correct regardless of what Claude wrote.
  // ============================================================================
  const recomputeScores = (rawEval) => {
    if (!rawEval || !Array.isArray(rawEval.behavioral_statements)) return rawEval;

    // Score values per Doerr Institute Level 1 ACC Scoring Algorithm
    const scoreFor = (rating) => {
      const map = {
        "Exemplary": 6,
        "Extremely Proficient": 5,
        "Proficient": 4,
        "Sufficient": 3,
        "Not quite sufficient": 2,
        "Insufficient": 1,
        "N/A": 1,
      };
      return map[rating] ?? null;
    };

    // Group behavioral statements by competency number
    const byComp = { 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };
    rawEval.behavioral_statements.forEach((s) => {
      const compNum = parseInt(s.code.split(".")[0], 10);
      const score = scoreFor(s.rating);
      if (compNum in byComp && score !== null) {
        byComp[compNum].push(score);
      }
    });

    // Compute competency averages
    const compAverages = {};
    [3, 4, 5, 6, 7, 8].forEach((n) => {
      const scores = byComp[n];
      compAverages[n] = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    });

    // Total raw score = average of competency averages
    const compAvgValues = Object.values(compAverages);
    const rawScore = compAvgValues.reduce((a, b) => a + b, 0) / compAvgValues.length;

    // Final score = (raw - 1) * 2
    const finalScore = (rawScore - 1) * 2;

    // Round to 2 decimal places
    const round2 = (n) => Math.round(n * 100) / 100;

    return {
      ...rawEval,
      score_calculation: {
        competency_3_average: round2(compAverages[3]),
        competency_4_average: round2(compAverages[4]),
        competency_5_average: round2(compAverages[5]),
        competency_6_average: round2(compAverages[6]),
        competency_7_average: round2(compAverages[7]),
        competency_8_average: round2(compAverages[8]),
        raw_score: round2(rawScore),
        final_score: round2(finalScore),
        result: finalScore >= 3.4 ? "Pass" : "Below Passing Standard",
      },
    };
  };

  // Doerr Institute color palette
  const colors = {
    navy: "#00205B",
    gray: "#7C7E7F",
    white: "#FFFFFF",
    skyBlue: "#69CCE6",
    softBlue: "#78B3E0",
    orange: "#FF8200",
    sage: "#C9D647",
    lightBg: "#F7F8FA",
    border: "#E5E7EB",
  };

  const fontStack = "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif";

  // ============================================================================
  // RENDER: HEADER (shared across stages)
  // ============================================================================
  const Header = () => (
    <header
      style={{
        backgroundColor: colors.navy,
        color: colors.white,
        padding: "24px 48px",
        borderBottom: `4px solid ${colors.orange}`,
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "11px", letterSpacing: "2.5px", fontWeight: 500, opacity: 0.85, marginBottom: "4px" }}>
            DOERR INSTITUTE FOR NEW LEADERS · COACHRICE LEVEL 1
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, letterSpacing: "-0.3px" }}>
            ICF ACC Performance Assessor
          </h1>
        </div>
        {stage !== "input" && (
          <button
            onClick={reset}
            style={{
              backgroundColor: "transparent",
              color: colors.white,
              border: `1px solid rgba(255,255,255,0.3)`,
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: fontStack,
              cursor: "pointer",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ← New Evaluation
          </button>
        )}
      </div>
    </header>
  );

  // ============================================================================
  // RENDER: INPUT STAGE
  // ============================================================================
  if (stage === "input") {
    return (
      <Layout active="assessor2025" pageTitle="Internal Assessor (2025)">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 32px" }}>
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "28px", fontWeight: 700, color: colors.navy, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
              Submit a Coaching Session Transcript
            </h2>
            <p style={{ fontSize: "15px", color: colors.gray, lineHeight: 1.6, margin: 0, maxWidth: "640px" }}>
              Upload a PDF or paste the transcript below. The transcript is evaluated against the ICF ACC Minimum Skill Requirements
              using the calibrated CoachRICE rubric and the Nov 2025 BARS guide.
            </p>
          </div>


          {/* Upload area */}
          <div
            style={{
              backgroundColor: colors.white,
              border: `2px dashed ${colors.border}`,
              borderRadius: "8px",
              padding: "40px",
              textAlign: "center",
              marginBottom: "24px",
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.softBlue)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border)}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            📤
            <div style={{ fontSize: "16px", fontWeight: 600, color: colors.navy, marginBottom: "4px" }}>
              {filename ? filename : "Click to upload PDF or .txt file"}
            </div>
            <div style={{ fontSize: "13px", color: colors.gray }}>
              {filename ? "File loaded — extracted text appears below" : "PDF text extraction happens in your browser"}
            </div>
          </div>

          <div style={{ textAlign: "center", color: colors.gray, fontSize: "13px", margin: "16px 0", letterSpacing: "1px" }}>
            — OR PASTE BELOW —
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste the full coaching session transcript here. Timestamps in any common format are accepted — (MM:SS), [HH:MM:SS], 12:34, etc. Sessions without timestamps will be referenced by speaker turn instead."
            style={{
              width: "100%",
              minHeight: "260px",
              padding: "16px",
              fontSize: "14px",
              fontFamily: fontStack,
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              resize: "vertical",
              backgroundColor: colors.white,
              color: "#1a1a1a",
              lineHeight: 1.6,
              boxSizing: "border-box",
            }}
          />

          {transcript.trim() && (
            <div style={{ marginTop: "12px", fontSize: "13px", color: colors.gray }}>
              {transcript.trim().split(/\s+/).length.toLocaleString()} words ready for evaluation.
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: "6px",
                color: "#991B1B",
                fontSize: "14px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              ⚠️
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              onClick={() => transcript.trim() && setStage("preview")}
              disabled={!transcript.trim()}
              style={{
                backgroundColor: transcript.trim() ? colors.navy : colors.border,
                color: colors.white,
                border: "none",
                padding: "14px 32px",
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: fontStack,
                letterSpacing: "0.5px",
                cursor: transcript.trim() ? "pointer" : "not-allowed",
                borderRadius: "6px",
                transition: "background-color 0.2s",
              }}
            >
              REVIEW TRANSCRIPT →
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ============================================================================
  // RENDER: PREVIEW STAGE
  // ============================================================================
  if (stage === "preview") {
    const wordCount = transcript.trim().split(/\s+/).length;
    // Detect any common timestamp format: MM:SS, H:MM:SS, HH:MM:SS,
    // optionally surrounded by parentheses or brackets. We use word boundaries
    // and bracket/paren markers to avoid false positives on regular numbers.
    const hasTimestamps = /(?:^|[\s(\[])\d{1,2}:\d{2}(?::\d{2})?(?:[\s)\],.]|$)/.test(transcript);

    return (
      <Layout active="assessor2025" pageTitle="Internal Assessor (2025)">
        <main style={{ maxWidth: "900px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 700, color: colors.navy, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
            Confirm the Extracted Transcript
          </h2>
          <p style={{ fontSize: "15px", color: colors.gray, lineHeight: 1.6, margin: "0 0 24px", maxWidth: "640px" }}>
            Spot-check the transcript before running. PDF extraction occasionally misplaces text or strips timestamps.
            Edit directly if needed.
          </p>

          <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
            <div style={{ padding: "12px 18px", backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: "6px", fontSize: "13px" }}>
              <span style={{ color: colors.gray }}>Words:</span>{" "}
              <span style={{ fontWeight: 600, color: colors.navy }}>{wordCount.toLocaleString()}</span>
            </div>
            <div style={{ padding: "12px 18px", backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: "6px", fontSize: "13px" }}>
              <span style={{ color: colors.gray }}>Timestamps detected:</span>{" "}
              <span style={{ fontWeight: 600, color: hasTimestamps ? colors.navy : colors.orange }}>
                {hasTimestamps ? "Yes" : "No — turns will be referenced instead"}
              </span>
            </div>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            style={{
              width: "100%",
              minHeight: "400px",
              padding: "20px",
              fontSize: "14px",
              fontFamily: fontStack,
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              resize: "vertical",
              backgroundColor: colors.white,
              color: "#1a1a1a",
              lineHeight: 1.7,
              boxSizing: "border-box",
            }}
          />

          {error && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: "6px",
                color: "#991B1B",
                fontSize: "14px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              ⚠️
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={() => setStage("input")}
              style={{
                backgroundColor: "transparent",
                color: colors.navy,
                border: `1px solid ${colors.navy}`,
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: 500,
                fontFamily: fontStack,
                cursor: "pointer",
                borderRadius: "6px",
              }}
            >
              ← BACK
            </button>
            <button
              onClick={runEvaluation}
              style={{
                backgroundColor: colors.orange,
                color: colors.white,
                border: "none",
                padding: "14px 32px",
                fontSize: "14px",
                fontWeight: 700,
                fontFamily: fontStack,
                letterSpacing: "0.5px",
                cursor: "pointer",
                borderRadius: "6px",
                boxShadow: "0 2px 8px rgba(255,130,0,0.25)",
              }}
            >
              RUN EVALUATION →
            </button>
          </div>
        </main>
      </Layout>
    );
  }

  // ============================================================================
  // RENDER: RUNNING STAGE
  // ============================================================================
  if (stage === "running") {
    return (
      <Layout active="assessor2025" pageTitle="Internal Assessor (2025)">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "120px 32px", textAlign: "center" }}>
          ⏳
          <h2 style={{ fontSize: "24px", fontWeight: 600, color: colors.navy, margin: "0 0 8px" }}>
            Evaluating against the BARS rubric
          </h2>
          <p style={{ fontSize: "15px", color: colors.gray, margin: 0 }}>
            Reading the transcript end-to-end, identifying evidence, applying calibration anchors. Usually 30–60 seconds.
          </p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </Layout>
    );
  }

  // ============================================================================
  // RENDER: REPORT STAGE
  // ============================================================================
  if (stage === "report" && evaluation) {
    const ratingColor = (rating) => {
      if (rating === "Exemplary" || rating === "Extremely Proficient") return colors.skyBlue;
      if (rating === "Proficient") return colors.sage;
      if (rating === "Sufficient") return "#FCD34D";
      return "#FCA5A5";
    };

    const competencyTitles = {
      3: "Establishes and Maintains Agreements",
      4: "Cultivates Trust and Safety",
      5: "Maintains Presence",
      6: "Listens Actively",
      7: "Evokes Awareness",
      8: "Facilitates Client Growth",
    };

    const groupedStatements = {};
    evaluation.behavioral_statements?.forEach((s) => {
      const compNum = s.code.split(".")[0];
      if (!groupedStatements[compNum]) groupedStatements[compNum] = [];
      groupedStatements[compNum].push(s);
    });

    return (
      <Layout active="assessor2025" pageTitle="Internal Assessor (2025)">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "20px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: colors.gray, marginBottom: "6px", letterSpacing: "0.5px" }}>
                FILE NAME (without extension)
              </label>
              <input
                type="text"
                value={customDownloadFilename}
                onChange={(e) => setCustomDownloadFilename(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "14px",
                  fontFamily: fontStack,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
                placeholder="ACC_Evaluation_2025_Coach"
              />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
            onClick={downloadText}
            style={{
              backgroundColor: "transparent",
              color: colors.navy,
              border: `1px solid ${colors.navy}`,
              padding: "12px 24px",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: fontStack,
              letterSpacing: "0.5px",
              cursor: "pointer",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            📄 DOWNLOAD AS TEXT
          </button>
          <button
            onClick={downloadPDF}
            disabled={!jsPdfLoaded}
            style={{
              backgroundColor: jsPdfLoaded ? colors.navy : colors.border,
              color: colors.white,
              border: "none",
              padding: "12px 24px",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: fontStack,
              letterSpacing: "0.5px",
              cursor: jsPdfLoaded ? "pointer" : "wait",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            📥 {jsPdfLoaded ? "DOWNLOAD AS PDF" : "PREPARING..."}
          </button>
            </div>
          </div>
        </div>

        {/* Report content displayed on screen — PDF is generated separately via jsPDF */}
        <main
          ref={reportRef}
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            padding: "48px",
            backgroundColor: colors.white,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            color: "#1a1a1a",
            fontFamily: fontStack,
          }}
        >
          {/* Report header */}
          <div style={{ borderBottom: `3px solid ${colors.navy}`, paddingBottom: "20px", marginBottom: "32px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "2.5px", color: colors.gray, fontWeight: 500, marginBottom: "8px" }}>
              DOERR INSTITUTE FOR NEW LEADERS · COACHRICE LEVEL 1
            </div>
            <h1 style={{ fontSize: "26px", fontWeight: 700, color: colors.navy, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
              ACC Performance Evaluation
            </h1>
            <div style={{ fontSize: "14px", color: colors.gray, display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <span>
                <strong style={{ color: colors.navy }}>Coach:</strong> {evaluation.coach_identifier}
              </span>
              <span>
                <strong style={{ color: colors.navy }}>Date:</strong> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
              <span>
                <strong style={{ color: colors.navy }}>Rubric:</strong> ICF ACC BARS (Nov 2025)
              </span>
            </div>
          </div>

          {/* Final Score Card */}
          <div
            style={{
              backgroundColor: evaluation.score_calculation?.result === "Pass" ? "#F0FDF4" : "#FEF2F2",
              border: `2px solid ${evaluation.score_calculation?.result === "Pass" ? "#86EFAC" : "#FCA5A5"}`,
              borderRadius: "8px",
              padding: "24px 32px",
              marginBottom: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", letterSpacing: "2px", color: colors.gray, fontWeight: 500, marginBottom: "4px" }}>
                FINAL SCORE
              </div>
              <div style={{ fontSize: "44px", fontWeight: 700, color: colors.navy, lineHeight: 1, letterSpacing: "-1px" }}>
                {evaluation.score_calculation?.final_score?.toFixed(2)}
              </div>
              <div style={{ fontSize: "13px", color: colors.gray, marginTop: "4px" }}>
                Pass threshold: 3.40
              </div>
            </div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                padding: "12px 24px",
                borderRadius: "6px",
                backgroundColor: evaluation.score_calculation?.result === "Pass" ? "#16A34A" : "#DC2626",
                color: colors.white,
                letterSpacing: "1.5px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {evaluation.score_calculation?.result === "Pass" && "✓"}
              {evaluation.score_calculation?.result === "Pass" ? "PASS" : "BELOW PASSING"}
            </div>
          </div>

          {/* Competency 1 — Ethical Practice */}
          <Section title="1. Demonstrates Ethical Practice" subtitle="Understands and consistently applies coaching ethics and standards of coaching." colors={colors}>
            <div style={{ overflow: "hidden", borderRadius: "6px", border: `1px solid ${colors.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: "11px", letterSpacing: "1px" }}>QUALIFIER</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, fontSize: "11px", letterSpacing: "1px", width: "180px" }}>OBSERVED</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: colors.white, borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "12px 16px" }}>1. Coach demonstrates alignment with the ICF Code of Ethics.</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: evaluation.ethical_practice?.icf_code_alignment === "Observed" ? "#16A34A" : "#DC2626" }}>
                      {evaluation.ethical_practice?.icf_code_alignment}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: colors.white }}>
                    <td style={{ padding: "12px 16px" }}>2. Coach demonstrates consistent alignment with the role of "coach."</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: evaluation.ethical_practice?.coach_role_alignment === "Observed" ? "#16A34A" : "#DC2626" }}>
                      {evaluation.ethical_practice?.coach_role_alignment}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {evaluation.ethical_practice?.icf_code_alignment_note && (
              <div style={{ marginTop: "12px", padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "6px", fontSize: "13px", color: "#991B1B" }}>
                <strong>Code of Ethics note:</strong> {evaluation.ethical_practice.icf_code_alignment_note}
              </div>
            )}
            {evaluation.ethical_practice?.coach_role_alignment_note && (
              <div style={{ marginTop: "12px", padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "6px", fontSize: "13px", color: "#991B1B" }}>
                <strong>Coach role note:</strong> {evaluation.ethical_practice.coach_role_alignment_note}
              </div>
            )}
          </Section>

          {/* Competency 2 — informational */}
          <Section title="2. Embodies a Coaching Mindset" subtitle="Develops and maintains a mindset that is open, curious, flexible and client-centered." colors={colors}>
            <p style={{ fontSize: "13px", color: colors.gray, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
              There are no Behavioral Statements for Competency 2 in the ACC BARS system. Candidates are assessed on their knowledge
              of and ability to apply Competency 2 as part of the ICF Credentialing Exam.
            </p>
          </Section>

          {/* Competencies 3–8 — behavioral statements */}
          {[3, 4, 5, 6, 7, 8].map((compNum) => {
            const compAvg = evaluation.score_calculation?.[`competency_${compNum}_average`];
            return (
              <Section
                key={compNum}
                title={`${compNum}. ${competencyTitles[compNum]}`}
                colors={colors}
                rightLabel={compAvg !== undefined ? `Avg: ${compAvg.toFixed(2)}` : null}
              >
                <div style={{ overflow: "hidden", borderRadius: "6px", border: `1px solid ${colors.border}` }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: "11px", letterSpacing: "1px" }}>BEHAVIORAL STATEMENT</th>
                        <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, fontSize: "11px", letterSpacing: "1px", width: "200px" }}>RATING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(groupedStatements[compNum] || []).map((s, idx) => (
                        <React.Fragment key={s.code}>
                          <tr style={{ backgroundColor: colors.white }}>
                            <td style={{ padding: "14px 16px", borderTop: idx > 0 ? `1px solid ${colors.border}` : "none" }}>
                              <div style={{ fontWeight: 600, color: colors.navy, marginBottom: "4px" }}>{s.code}</div>
                              <div style={{ color: "#1a1a1a", lineHeight: 1.5 }}>{s.title}</div>
                            </td>
                            <td style={{ padding: "14px 16px", textAlign: "right", borderTop: idx > 0 ? `1px solid ${colors.border}` : "none", verticalAlign: "top" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "5px 12px",
                                  backgroundColor: ratingColor(s.rating),
                                  color: colors.navy,
                                  fontWeight: 600,
                                  fontSize: "11px",
                                  letterSpacing: "0.5px",
                                  borderRadius: "4px",
                                  textTransform: "uppercase",
                                }}
                              >
                                {s.rating}
                              </span>
                            </td>
                          </tr>
                          <tr style={{ backgroundColor: colors.lightBg }}>
                            <td colSpan={2} style={{ padding: "10px 16px", fontSize: "12px", color: "#374151", lineHeight: 1.6 }}>
                              <strong style={{ color: colors.navy, fontSize: "10px", letterSpacing: "1px" }}>EVIDENCE:</strong>{" "}
                              {(s.evidence || []).map((e, i) => (
                                <span key={i}>
                                  <strong style={{ color: colors.navy }}>{e.timestamp}</strong>{" "}
                                  <em>"{e.quote}"</em>
                                  {i < (s.evidence?.length || 0) - 1 && <span style={{ color: colors.gray }}> · </span>}
                                </span>
                              ))}
                              {s.contra_evidence && (
                                <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: `1px dashed ${colors.border}`, color: "#991B1B" }}>
                                  <strong style={{ fontSize: "10px", letterSpacing: "1px" }}>CONTRA:</strong> {s.contra_evidence}
                                </div>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            );
          })}

          {/* Score Calculation */}
          <Section title="Score Calculation" colors={colors}>
            <div style={{ overflow: "hidden", borderRadius: "6px", border: `1px solid ${colors.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                    <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: "11px", letterSpacing: "1px" }}>COMPETENCY</th>
                    <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, fontSize: "11px", letterSpacing: "1px", width: "160px" }}>AVERAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {[3, 4, 5, 6, 7, 8].map((n, idx) => {
                    const avg = evaluation.score_calculation?.[`competency_${n}_average`];
                    return (
                      <tr key={n} style={{ backgroundColor: colors.white, borderTop: idx > 0 ? `1px solid ${colors.border}` : "none" }}>
                        <td style={{ padding: "10px 16px" }}>
                          {n}. {competencyTitles[n]}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: colors.navy }}>{avg?.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: colors.lightBg, borderTop: `2px solid ${colors.navy}` }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: colors.navy }}>Total Raw Score (avg of competency averages)</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: colors.navy }}>
                      {evaluation.score_calculation?.raw_score?.toFixed(2)}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: "14px" }}>Final Score = (Raw − 1) × 2</td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, fontSize: "16px" }}>
                      {evaluation.score_calculation?.final_score?.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Strengths */}
          <Section title="Coaching Competency Strengths" colors={colors}>
            {(evaluation.strengths || []).map((s, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: idx < (evaluation.strengths.length - 1) ? "16px" : 0,
                  padding: "16px 20px",
                  backgroundColor: colors.white,
                  borderLeft: `4px solid ${colors.sage}`,
                  borderRadius: "0 6px 6px 0",
                  border: `1px solid ${colors.border}`,
                  borderLeftWidth: "4px",
                }}
              >
                <div style={{ fontSize: "11px", letterSpacing: "1px", color: colors.gray, fontWeight: 600, marginBottom: "4px" }}>
                  {s.competency_name?.toUpperCase()} · {s.code}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: colors.navy, marginBottom: "8px" }}>
                  {s.statement_title}
                </div>
                <div style={{ fontSize: "13px", lineHeight: 1.6, color: "#374151" }}>{s.explanation}</div>
              </div>
            ))}
          </Section>

          {/* Suggestions */}
          <Section title="Suggestions for Competency Development" colors={colors}>
            {(evaluation.suggestions || []).map((s, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: idx < (evaluation.suggestions.length - 1) ? "16px" : 0,
                  padding: "16px 20px",
                  backgroundColor: colors.white,
                  borderLeft: `4px solid ${colors.softBlue}`,
                  borderRadius: "0 6px 6px 0",
                  border: `1px solid ${colors.border}`,
                  borderLeftWidth: "4px",
                }}
              >
                <div style={{ fontSize: "11px", letterSpacing: "1px", color: colors.gray, fontWeight: 600, marginBottom: "4px" }}>
                  {s.competency_name?.toUpperCase()} · {s.code}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: colors.navy, marginBottom: "8px" }}>
                  {s.statement_title}
                </div>
                <div style={{ fontSize: "13px", lineHeight: 1.6, color: "#374151", marginBottom: "10px" }}>{s.missed_opportunity}</div>
                {s.example_prompts && s.example_prompts.length > 0 && (
                  <div style={{ fontSize: "12px", color: colors.gray, fontStyle: "italic" }}>
                    <strong style={{ color: colors.navy, fontStyle: "normal" }}>Example prompts the coach could have used:</strong>
                    <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
                      {s.example_prompts.map((p, i) => (
                        <li key={i} style={{ marginBottom: "3px" }}>"{p}"</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </Section>

          {/* Calibration Divergence Flags */}
          {evaluation.divergence_flags && evaluation.divergence_flags.length > 0 && (
            <Section title="Calibration Divergence Flags" subtitle="Skills where this AI assessor's strict read may differ from a typical human assessor's read. Use these as comparison points when reviewing a human assessor's evaluation." colors={colors}>
              <div style={{ overflow: "hidden", borderRadius: "6px", border: `1px solid ${colors.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: "11px", letterSpacing: "1px", width: "60px" }}>CODE</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: "11px", letterSpacing: "1px", width: "150px" }}>AI READ</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: "11px", letterSpacing: "1px", width: "150px" }}>LIKELY HUMAN READ</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: "11px", letterSpacing: "1px" }}>WHY THEY MAY DIVERGE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluation.divergence_flags.map((d, idx) => (
                      <tr key={idx} style={{ backgroundColor: colors.white, borderTop: idx > 0 ? `1px solid ${colors.border}` : "none" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 700, color: colors.navy, verticalAlign: "top" }}>{d.code}</td>
                        <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 600 }}>{d.ai_rating}</div>
                          <div style={{ fontSize: "11px", color: colors.gray, marginTop: "2px" }}>
                            {d.direction === "AI rated lower" ? "↓ stricter" : "↑ more generous"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", verticalAlign: "top", fontWeight: 600, color: colors.gray }}>{d.likely_human_rating}</td>
                        <td style={{ padding: "12px 14px", verticalAlign: "top", lineHeight: 1.5, color: "#374151" }}>{d.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Ethical Concerns */}
          <Section title="Ethical Concerns" colors={colors}>
            <div style={{ fontSize: "13px", color: evaluation.ethical_concerns === "None" ? colors.gray : "#991B1B", lineHeight: 1.6 }}>
              {evaluation.ethical_concerns}
            </div>
          </Section>

          {/* Footer */}
          <div style={{ marginTop: "48px", paddingTop: "20px", borderTop: `1px solid ${colors.border}`, fontSize: "10px", color: colors.gray, textAlign: "center", letterSpacing: "0.5px" }}>
            GENERATED BY THE COACHRICE ICF ACC ASSESSOR · DOERR INSTITUTE FOR NEW LEADERS · CALIBRATED TO ICF BARS NOV 2025
          </div>
        </main>
      </Layout>
    );
  }

  return null;
}

// ============================================================================
// SECTION COMPONENT
// ============================================================================
function Section({ title, subtitle, children, colors, rightLabel }) {
  return (
    <section style={{ marginBottom: "36px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `1px solid ${colors.border}`, paddingBottom: "8px", marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: colors.navy, margin: 0, letterSpacing: "-0.2px" }}>
            {title}
          </h2>
          {subtitle && (
            <div style={{ fontSize: "12px", color: colors.gray, marginTop: "3px", fontStyle: "italic" }}>{subtitle}</div>
          )}
        </div>
        {rightLabel && (
          <div style={{ fontSize: "11px", letterSpacing: "1px", color: colors.gray, fontWeight: 600 }}>
            {rightLabel}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
