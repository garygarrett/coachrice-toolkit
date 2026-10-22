import React, { useRef, useState, useEffect } from 'react'
import { competencyNumber } from '../lib/competency'
import { buildAssessorPdf } from '../lib/assessor/pdf'

const COLORS = {
  navy: '#00205B',
  teal: '#69cce6',
  orange: '#ff8200',
  gray: '#7C7E7F',
  'gray-light': '#f0f2f5',
  'gray-border': '#e2e6ec',
  white: '#ffffff',
  'text-main': '#0f1c3a',
  'text-muted': '#6b7a99',
  border: '#e2e6ec',
  lightBg: '#f9fafc',
}

const competencyTitles = {
  3: 'Establishes and Maintains Agreements',
  4: 'Cultivates Trust and Safety',
  5: 'Maintains Presence',
  6: 'Listens Actively',
  7: 'Evokes Awareness',
  8: 'Facilitates Client Growth',
}

// Reusable Section component from Assessor2025.jsx
function Section({ title, subtitle, children, colors, rightLabel }) {
  return (
    <section style={{ marginBottom: '36px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`, paddingBottom: '8px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: colors.navy, margin: 0, letterSpacing: '-0.2px' }}>
            {title}
          </h2>
          {subtitle && (
            <div style={{ fontSize: '12px', color: colors.gray, marginTop: '3px', fontStyle: 'italic' }}>{subtitle}</div>
          )}
        </div>
        {rightLabel && (
          <div style={{ fontSize: '11px', letterSpacing: '1px', color: colors.gray, fontWeight: 600 }}>
            {rightLabel}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}

// Reusable rating color function
function ratingColor(rating) {
  const colors = {
    "Exceeds the Standard": '#dbeafe',
    "Meets the Standard": '#dcfce7',
    "Below the Standard": '#fed7aa',
    "Does Not Meet Standard": '#fee2e2',
  }
  return colors[rating] || '#f3f4f6'
}

// Main assessment report display component
export function AssessmentReportDisplay({ assessment }) {
  const colors = COLORS
  const evaluation = assessment.assessment_data || {}
  const groupedStatements = {}

  ;(evaluation.behavioral_statements || []).forEach((s) => {
    const c = competencyNumber(s.code)
    if (!groupedStatements[c]) groupedStatements[c] = []
    groupedStatements[c].push(s)
  })

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '48px',
        backgroundColor: colors.white,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        color: '#1a1a1a',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {/* Report header */}
      <div style={{ borderBottom: `3px solid ${colors.navy}`, paddingBottom: '20px', marginBottom: '32px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '2.5px', color: colors.gray, fontWeight: 500, marginBottom: '8px' }}>
          DOERR INSTITUTE FOR NEW LEADERS · COACHRICE LEVEL 1
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: colors.navy, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
          ACC Performance Evaluation
        </h1>
        <div style={{ fontSize: '14px', color: colors.gray, display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <span>
            <strong style={{ color: colors.navy }}>Coach:</strong> {evaluation.coach_identifier}
          </span>
          <span>
            <strong style={{ color: colors.navy }}>Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <span>
            <strong style={{ color: colors.navy }}>Rubric:</strong> {assessment.assessor_type === '2025' ? 'ICF ACC BARS (Nov 2025)' : 'ICF ACC BARS (March 2024)'}
          </span>
          {assessment.transcript_filename && (
            <span>
              <strong style={{ color: colors.navy }}>Transcript:</strong> {assessment.transcript_filename}
            </span>
          )}
        </div>
      </div>

      {/* Final Score Card */}
      <div
        style={{
          backgroundColor: evaluation.score_calculation?.result === 'Pass' ? '#F0FDF4' : '#FEF2F2',
          border: `2px solid ${evaluation.score_calculation?.result === 'Pass' ? '#86EFAC' : '#FCA5A5'}`,
          borderRadius: '8px',
          padding: '24px 32px',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '2px', color: colors.gray, fontWeight: 500, marginBottom: '4px' }}>
            FINAL SCORE
          </div>
          <div style={{ fontSize: '44px', fontWeight: 700, color: colors.navy, lineHeight: 1, letterSpacing: '-1px' }}>
            {evaluation.score_calculation?.final_score?.toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: colors.gray, marginTop: '4px' }}>
            Pass threshold: 3.40
          </div>
        </div>
        <div
          style={{
            fontSize: '20px',
            fontWeight: 700,
            padding: '12px 24px',
            borderRadius: '6px',
            backgroundColor: evaluation.score_calculation?.result === 'Pass' ? '#16A34A' : '#DC2626',
            color: colors.white,
            letterSpacing: '1.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {evaluation.score_calculation?.result === 'Pass' && '✓'}
          {evaluation.score_calculation?.result === 'Pass' ? 'PASS' : 'BELOW PASSING'}
        </div>
      </div>

      {/* Competency 1 — Ethical Practice */}
      <Section title="1. Demonstrates Ethical Practice" subtitle="Understands and consistently applies coaching ethics and standards of coaching." colors={colors}>
        <div style={{ overflow: 'hidden', borderRadius: '6px', border: `1px solid ${colors.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '11px', letterSpacing: '1px' }}>QUALIFIER</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '11px', letterSpacing: '1px', width: '180px' }}>OBSERVED</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ backgroundColor: colors.white, borderBottom: `1px solid ${colors.border}` }}>
                <td style={{ padding: '12px 16px' }}>1. Coach demonstrates alignment with the ICF Code of Ethics.</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: evaluation.ethical_practice?.icf_code_alignment === 'Observed' ? '#16A34A' : '#DC2626' }}>
                  {evaluation.ethical_practice?.icf_code_alignment}
                </td>
              </tr>
              <tr style={{ backgroundColor: colors.white }}>
                <td style={{ padding: '12px 16px' }}>2. Coach demonstrates consistent alignment with the role of "coach."</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: evaluation.ethical_practice?.coach_role_alignment === 'Observed' ? '#16A34A' : '#DC2626' }}>
                  {evaluation.ethical_practice?.coach_role_alignment}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Ethical Practice Notes */}
        {(evaluation.ethical_practice?.icf_code_alignment === 'Not Observed' && evaluation.ethical_practice?.icf_code_alignment_note) && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: colors.lightBg, borderLeft: `4px solid ${colors.orange}`, borderRadius: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: colors.navy, marginBottom: '6px' }}>
              Rationale: ICF Code of Ethics Alignment
            </div>
            <div style={{ fontSize: '12px', color: colors['text-muted'], fontStyle: 'italic', lineHeight: 1.5 }}>
              {evaluation.ethical_practice.icf_code_alignment_note}
            </div>
          </div>
        )}

        {(evaluation.ethical_practice?.coach_role_alignment === 'Not Observed' && evaluation.ethical_practice?.coach_role_alignment_note) && (
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: colors.lightBg, borderLeft: `4px solid ${colors.orange}`, borderRadius: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: colors.navy, marginBottom: '6px' }}>
              Rationale: Coach Role Alignment
            </div>
            <div style={{ fontSize: '12px', color: colors['text-muted'], fontStyle: 'italic', lineHeight: 1.5 }}>
              {evaluation.ethical_practice.coach_role_alignment_note}
            </div>
          </div>
        )}
      </Section>

      {/* Competency 2 — informational */}
      <Section title="2. Embodies a Coaching Mindset" subtitle="Develops and maintains a mindset that is open, curious, flexible and client-centered." colors={colors}>
        <p style={{ fontSize: '13px', color: colors.gray, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
          There are no Behavioral Statements for Competency 2 in the ACC BARS system. Candidates are assessed on their knowledge of and ability to apply Competency 2 as part of the ICF Credentialing Exam.
        </p>
      </Section>

      {/* Competencies 3–8 — behavioral statements */}
      {[3, 4, 5, 6, 7, 8].map((compNum) => {
        const compAvg = evaluation.score_calculation?.[`competency_${compNum}_average`]
        return (
          <Section
            key={compNum}
            title={`${compNum}. ${competencyTitles[compNum]}`}
            colors={colors}
            rightLabel={compAvg !== undefined ? `Avg: ${compAvg.toFixed(2)}` : null}
          >
            <div style={{ overflow: 'hidden', borderRadius: '6px', border: `1px solid ${colors.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '11px', letterSpacing: '1px' }}>BEHAVIORAL STATEMENT</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '11px', letterSpacing: '1px', width: '200px' }}>RATING</th>
                  </tr>
                </thead>
                <tbody>
                  {(groupedStatements[compNum] || []).map((s, idx) => (
                    <React.Fragment key={s.code}>
                      <tr style={{ backgroundColor: colors.white }}>
                        <td style={{ padding: '14px 16px', borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none' }}>
                          <div style={{ fontWeight: 600, color: colors.navy, marginBottom: '4px' }}>{s.code}</div>
                          <div style={{ color: '#1a1a1a', lineHeight: 1.5 }}>{s.title}</div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none', verticalAlign: 'top' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '5px 12px',
                              backgroundColor: ratingColor(s.rating),
                              color: colors.navy,
                              fontWeight: 600,
                              fontSize: '11px',
                              letterSpacing: '0.5px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                            }}
                          >
                            {s.rating}
                          </span>
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: colors.lightBg }}>
                        <td colSpan={2} style={{ padding: '10px 16px', fontSize: '12px', color: '#374151', lineHeight: 1.6 }}>
                          <strong style={{ color: colors.navy, fontSize: '10px', letterSpacing: '1px' }}>EVIDENCE:</strong>{' '}
                          {(s.evidence || []).map((e, i) => (
                            <span key={i}>
                              <strong style={{ color: colors.navy }}>{e.timestamp}</strong>{' '}
                              <em>"{e.quote}"</em>
                              {i < (s.evidence?.length || 0) - 1 && <span style={{ color: colors.gray }}> · </span>}
                            </span>
                          ))}
                          {s.contra_evidence && (
                            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px dashed ${colors.border}`, color: '#991B1B' }}>
                              <strong style={{ fontSize: '10px', letterSpacing: '1px' }}>CONTRA:</strong> {s.contra_evidence}
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
        )
      })}

      {/* Score Calculation */}
      <Section title="Score Calculation" colors={colors}>
        <div style={{ overflow: 'hidden', borderRadius: '6px', border: `1px solid ${colors.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '11px', letterSpacing: '1px' }}>COMPETENCY</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: '11px', letterSpacing: '1px', width: '160px' }}>AVERAGE</th>
              </tr>
            </thead>
            <tbody>
              {[3, 4, 5, 6, 7, 8].map((n, idx) => {
                const avg = evaluation.score_calculation?.[`competency_${n}_average`]
                return (
                  <tr key={n} style={{ backgroundColor: colors.white, borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none' }}>
                    <td style={{ padding: '10px 16px' }}>
                      {n}. {competencyTitles[n]}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: colors.navy }}>{avg?.toFixed(2)}</td>
                  </tr>
                )
              })}
              <tr style={{ backgroundColor: colors.lightBg, borderTop: `2px solid ${colors.navy}` }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: colors.navy }}>Total Raw Score (avg of competency averages)</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: colors.navy }}>
                  {evaluation.score_calculation?.raw_score?.toFixed(2)}
                </td>
              </tr>
              <tr style={{ backgroundColor: colors.navy, color: colors.white }}>
                <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px' }}>Final Score = (Raw − 1) × {String(evaluation.guide_version || '').startsWith('Nov 2025') ? '2.5' : '2'}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: '16px' }}>
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
              marginBottom: idx < (evaluation.strengths.length - 1) ? '16px' : 0,
              padding: '16px 20px',
              backgroundColor: colors.white,
              border: `1px solid ${colors.border}`,
              borderLeft: `4px solid #16A34A`,
              borderRadius: '0 4px 4px 0',
            }}
          >
            <div style={{ fontSize: '10px', color: colors['text-muted'], fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {s.competency_name} · {s.code}
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.navy, marginBottom: '8px' }}>
              {s.statement_title}
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
              {s.explanation}
            </div>
          </div>
        ))}
      </Section>

      {/* Suggestions */}
      <Section title="Suggestions for Competency Development" colors={colors}>
        {(evaluation.suggestions || []).map((s, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: idx < (evaluation.suggestions.length - 1) ? '16px' : 0,
              padding: '16px 20px',
              backgroundColor: colors.white,
              border: `1px solid ${colors.border}`,
              borderLeft: `4px solid #DC2626`,
              borderRadius: '0 4px 4px 0',
            }}
          >
            <div style={{ fontSize: '10px', color: colors['text-muted'], fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {s.competency_name} · {s.code}
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.navy, marginBottom: '8px' }}>
              {s.statement_title}
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#374151', marginBottom: '8px' }}>
              {s.missed_opportunity}
            </div>
            {s.example_prompts?.length > 0 && (
              <div style={{ fontSize: '12px', color: colors['text-main'] }}>
                <strong>Example prompts:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                  {s.example_prompts.map((prompt, i) => (
                    <li key={i} style={{ marginBottom: '2px', fontStyle: 'italic' }}>"{prompt}"</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* Footer */}
      <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: `1px solid ${colors.border}`, fontSize: '10px', color: colors.gray, textAlign: 'center', letterSpacing: '0.5px' }}>
        GENERATED BY THE COACHRICE ICF ACC ASSESSOR · DOERR INSTITUTE FOR NEW LEADERS · CALIBRATED TO ICF BARS {assessment.assessor_type === '2025' ? 'NOV 2025' : 'MARCH 2024'}
      </div>
    </div>
  )
}

// Downloads a saved assessment as a PDF in the Transcript Reviewer's layout
// (same builder the Internal Assessor tool uses).
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export async function generateAssessmentPDF(assessment) {
  try {
    if (!window.jspdf) await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    if (!window.jspdf?.jsPDF?.prototype?.autoTable) {
      await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
    }
    const versionId = assessment.assessor_type === '2025' ? '2025' : '2021'
    const doc = buildAssessorPdf({
      versionId,
      evaluation: assessment.assessment_data || {},
      sourceName: assessment.transcript_filename,
    })
    const base = (assessment.transcript_filename || `Assessment_${assessment.id}`).replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_')
    doc.save(`ACC_Evaluation_${versionId}_${base}.pdf`)
  } catch (err) {
    console.error('PDF generation failed:', err)
    alert('The PDF could not be created: ' + (err?.message || 'unknown error'))
  }
}
