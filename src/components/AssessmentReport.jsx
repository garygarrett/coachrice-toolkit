import React, { useRef, useState, useEffect } from 'react'

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
    const c = parseInt(s.code.split('.')[0], 10)
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
                <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px' }}>Final Score = (Raw − 1) × 2</td>
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

// PDF generation function extracted from Assessor2025.jsx
export function generateAssessmentPDF(assessment) {
  if (!window.jspdf) {
    alert('PDF library still loading. Please wait a moment and try again.')
    return
  }

  const { jsPDF } = window.jspdf
  const evaluation = assessment.assessment_data || {}
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  // Doerr brand colors as RGB
  const NAVY = [0, 32, 91]
  const ORANGE = [255, 130, 0]
  const GRAY = [124, 126, 127]
  const LIGHT_GRAY = [229, 231, 235]
  const SAGE = [201, 214, 71]
  const SOFT_BLUE = [120, 179, 224]
  const SKY_BLUE = [105, 204, 230]
  const TEXT = [26, 26, 26]
  const PASS_GREEN = [22, 163, 74]
  const FAIL_RED = [220, 38, 38]

  const PAGE_W = 612
  const PAGE_H = 792
  const MARGIN_X = 54
  const MARGIN_TOP = 60
  const MARGIN_BOTTOM = 60
  const CONTENT_W = PAGE_W - MARGIN_X * 2

  let y = MARGIN_TOP

  const ratingColorPDF = (rating) => {
    if (rating === 'Exceeds the Standard' || rating === 'Extremely Proficient') return SKY_BLUE
    if (rating === 'Meets the Standard' || rating === 'Proficient') return SAGE
    if (rating === 'Below the Standard' || rating === 'Sufficient') return [252, 211, 77]
    return [252, 165, 165]
  }

  const ensureSpace = (needed) => {
    if (y + needed > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage()
      y = MARGIN_TOP
    }
  }

  const drawCoverHeader = () => {
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, PAGE_W, 6, 'F')
    doc.setFillColor(...ORANGE)
    doc.rect(0, 6, PAGE_W, 3, 'F')

    y = MARGIN_TOP + 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('DOERR INSTITUTE FOR NEW LEADERS  ·  COACHRICE LEVEL 1', MARGIN_X, y)
    y += 22

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...NAVY)
    doc.text('ACC Performance Evaluation', MARGIN_X, y)
    y += 22

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GRAY)
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    doc.text(`Coach: ${evaluation.coach_identifier || 'Submitted Coach'}`, MARGIN_X, y)
    doc.text(`Date: ${dateStr}`, MARGIN_X + 220, y)
    doc.text(`Rubric: ICF ACC BARS (${assessment.assessor_type === '2025' ? 'Nov 2025' : 'March 2024'})`, MARGIN_X + 380, y)
    if (assessment.transcript_filename) {
      y += 18
      doc.text(`Transcript: ${assessment.transcript_filename}`, MARGIN_X, y)
    }
    y += 18

    doc.setDrawColor(...NAVY)
    doc.setLineWidth(2)
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
    y += 24
  }

  const drawScoreBox = () => {
    ensureSpace(90)
    const sc = evaluation.score_calculation || {}
    const isPass = sc.result === 'Pass'
    const bgColor = isPass ? [240, 253, 244] : [254, 242, 242]
    const borderColor = isPass ? [134, 239, 172] : [252, 165, 165]

    doc.setFillColor(...bgColor)
    doc.setDrawColor(...borderColor)
    doc.setLineWidth(1.5)
    doc.roundedRect(MARGIN_X, y, CONTENT_W, 80, 6, 6, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('FINAL SCORE', MARGIN_X + 20, y + 22)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(36)
    doc.setTextColor(...NAVY)
    doc.text(String((sc.final_score ?? 0).toFixed(2)), MARGIN_X + 20, y + 58)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('Pass threshold: 3.40', MARGIN_X + 20, y + 72)

    const badgeColor = isPass ? PASS_GREEN : FAIL_RED
    const badgeText = isPass ? 'PASS' : 'BELOW PASSING'
    const badgeW = isPass ? 80 : 140
    doc.setFillColor(...badgeColor)
    doc.roundedRect(PAGE_W - MARGIN_X - badgeW - 16, y + 28, badgeW, 28, 4, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(255, 255, 255)
    doc.text(badgeText, PAGE_W - MARGIN_X - badgeW / 2 - 16, y + 46, { align: 'center' })

    y += 100
  }

  const drawSectionTitle = (title, subtitle = null, rightLabel = null) => {
    ensureSpace(40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NAVY)
    doc.text(title, MARGIN_X, y)
    if (rightLabel) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...GRAY)
      doc.text(rightLabel, PAGE_W - MARGIN_X, y, { align: 'right' })
    }
    y += 12
    if (subtitle) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(...GRAY)
      const lines = doc.splitTextToSize(subtitle, CONTENT_W)
      doc.text(lines, MARGIN_X, y)
      y += lines.length * 11
    }
    doc.setDrawColor(...LIGHT_GRAY)
    doc.setLineWidth(0.5)
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
    y += 14
  }

  const drawEthicalPractice = () => {
    drawSectionTitle('1. Demonstrates Ethical Practice', 'Understands and consistently applies coaching ethics and standards of coaching.')

    const ep = evaluation.ethical_practice || {}
    const rows = [
      ['1. Coach demonstrates alignment with the ICF Code of Ethics.', ep.icf_code_alignment || ''],
      ['2. Coach demonstrates consistent alignment with the role of "coach."', ep.coach_role_alignment || ''],
    ]

    ensureSpace(24)
    doc.setFillColor(...NAVY)
    doc.rect(MARGIN_X, y, CONTENT_W, 22, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('QUALIFIER', MARGIN_X + 10, y + 14)
    doc.text('OBSERVED', PAGE_W - MARGIN_X - 10, y + 14, { align: 'right' })
    y += 22

    rows.forEach(([qualifier, observed]) => {
      ensureSpace(28)
      doc.setFillColor(255, 255, 255)
      doc.rect(MARGIN_X, y, CONTENT_W, 26, 'F')
      doc.setDrawColor(...LIGHT_GRAY)
      doc.line(MARGIN_X, y + 26, PAGE_W - MARGIN_X, y + 26)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...TEXT)
      const qLines = doc.splitTextToSize(qualifier, CONTENT_W - 130)
      doc.text(qLines, MARGIN_X + 10, y + 16)

      const obsColor = observed === 'Observed' ? PASS_GREEN : FAIL_RED
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...obsColor)
      doc.text(observed, PAGE_W - MARGIN_X - 10, y + 16, { align: 'right' })

      y += 26
    })
    y += 14
  }

  const drawCompetency2 = () => {
    drawSectionTitle('2. Embodies a Coaching Mindset', 'Develops and maintains a mindset that is open, curious, flexible and client-centered.')
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    const text = 'There are no Behavioral Statements for Competency 2 in the ACC BARS system. Candidates are assessed on their knowledge of and ability to apply Competency 2 as part of the ICF Credentialing Exam.'
    const lines = doc.splitTextToSize(text, CONTENT_W)
    ensureSpace(lines.length * 11 + 16)
    doc.text(lines, MARGIN_X, y)
    y += lines.length * 11 + 16
  }

  const drawBehavioralStatements = () => {
    const grouped = {}
    ;(evaluation.behavioral_statements || []).forEach((s) => {
      const c = parseInt(s.code.split('.')[0], 10)
      if (!grouped[c]) grouped[c] = []
      grouped[c].push(s)
    })

    ;[3, 4, 5, 6, 7, 8].forEach((compNum) => {
      const compAvg = evaluation.score_calculation?.[`competency_${compNum}_average`]
      drawSectionTitle(
        `${compNum}. ${competencyTitles[compNum]}`,
        null,
        compAvg !== undefined ? `Avg: ${compAvg.toFixed(2)}` : null
      )

      const statements = grouped[compNum] || []
      statements.forEach((s) => {
        const titleLines = doc.splitTextToSize(s.title, CONTENT_W - 140)
        const evidenceText = (s.evidence || []).map(e => `${e.timestamp} "${e.quote}"`).join('  ·  ')
        const evidenceLines = doc.splitTextToSize(`EVIDENCE: ${evidenceText}`, CONTENT_W - 20)
        const contraLines = s.contra_evidence ? doc.splitTextToSize(`CONTRA: ${s.contra_evidence}`, CONTENT_W - 20) : []
        const totalH = 16 + titleLines.length * 11 + 8 + evidenceLines.length * 11 + (contraLines.length ? contraLines.length * 11 + 6 : 0) + 14
        ensureSpace(totalH)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...NAVY)
        doc.text(s.code, MARGIN_X, y + 12)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...TEXT)
        doc.text(titleLines, MARGIN_X + 32, y + 12)

        const chipColor = ratingColorPDF(s.rating)
        const chipText = s.rating || '—'
        const chipW = doc.getTextWidth(chipText) + 16
        doc.setFillColor(...chipColor)
        doc.roundedRect(PAGE_W - MARGIN_X - chipW, y + 2, chipW, 16, 3, 3, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...NAVY)
        doc.text(chipText.toUpperCase(), PAGE_W - MARGIN_X - chipW / 2, y + 13, { align: 'center' })

        y += Math.max(titleLines.length * 11 + 10, 22)

        doc.setFillColor(247, 248, 250)
        const evH = evidenceLines.length * 11 + (contraLines.length ? contraLines.length * 11 + 8 : 0) + 12
        doc.rect(MARGIN_X, y, CONTENT_W, evH, 'F')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...TEXT)
        doc.text(evidenceLines, MARGIN_X + 10, y + 12)

        if (contraLines.length) {
          const contraY = y + 12 + evidenceLines.length * 11 + 4
          doc.setDrawColor(...LIGHT_GRAY)
          doc.setLineDashPattern([2, 2], 0)
          doc.line(MARGIN_X + 10, contraY - 2, PAGE_W - MARGIN_X - 10, contraY - 2)
          doc.setLineDashPattern([], 0)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(153, 27, 27)
          doc.text(contraLines, MARGIN_X + 10, contraY + 8)
        }

        y += evH + 8
      })

      y += 8
    })
  }

  const drawScoreCalculation = () => {
    drawSectionTitle('Score Calculation')

    const sc = evaluation.score_calculation || {}

    ensureSpace(24)
    doc.setFillColor(...NAVY)
    doc.rect(MARGIN_X, y, CONTENT_W, 22, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('COMPETENCY', MARGIN_X + 10, y + 14)
    doc.text('AVERAGE', PAGE_W - MARGIN_X - 10, y + 14, { align: 'right' })
    y += 22

    ;[3, 4, 5, 6, 7, 8].forEach((n, idx) => {
      ensureSpace(22)
      doc.setFillColor(255, 255, 255)
      doc.rect(MARGIN_X, y, CONTENT_W, 20, 'F')
      if (idx > 0) {
        doc.setDrawColor(...LIGHT_GRAY)
        doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...TEXT)
      doc.text(`${n}. ${competencyTitles[n]}`, MARGIN_X + 10, y + 13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...NAVY)
      const avg = sc[`competency_${n}_average`]
      doc.text(avg !== undefined ? avg.toFixed(2) : '—', PAGE_W - MARGIN_X - 10, y + 13, { align: 'right' })
      y += 20
    })

    ensureSpace(26)
    doc.setFillColor(247, 248, 250)
    doc.rect(MARGIN_X, y, CONTENT_W, 24, 'F')
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(1.5)
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    doc.text('Total Raw Score (avg of competency averages)', MARGIN_X + 10, y + 15)
    doc.text(sc.raw_score !== undefined ? sc.raw_score.toFixed(2) : '—', PAGE_W - MARGIN_X - 10, y + 15, { align: 'right' })
    y += 24

    ensureSpace(28)
    doc.setFillColor(...NAVY)
    doc.rect(MARGIN_X, y, CONTENT_W, 26, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text('Final Score = (Raw − 1) × 2', MARGIN_X + 10, y + 17)
    doc.setFontSize(13)
    doc.text(sc.final_score !== undefined ? sc.final_score.toFixed(2) : '—', PAGE_W - MARGIN_X - 10, y + 18, { align: 'right' })
    y += 32
  }

  const drawStrengths = () => {
    drawSectionTitle('Coaching Competency Strengths')
    ;(evaluation.strengths || []).forEach((s) => {
      const explLines = doc.splitTextToSize(s.explanation || '', CONTENT_W - 24)
      const cardH = explLines.length * 11 + 50
      ensureSpace(cardH)

      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...LIGHT_GRAY)
      doc.rect(MARGIN_X, y, CONTENT_W, cardH, 'FD')
      doc.setFillColor(...SAGE)
      doc.rect(MARGIN_X, y, 4, cardH, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...GRAY)
      doc.text(`${(s.competency_name || '').toUpperCase()}  ·  ${s.code}`, MARGIN_X + 16, y + 14)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...NAVY)
      const titleLines = doc.splitTextToSize(s.statement_title || '', CONTENT_W - 24)
      doc.text(titleLines, MARGIN_X + 16, y + 28)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...TEXT)
      const explY = y + 28 + titleLines.length * 11 + 4
      doc.text(explLines, MARGIN_X + 16, explY)

      y += cardH + 10
    })
  }

  const drawSuggestions = () => {
    drawSectionTitle('Suggestions for Competency Development')
    ;(evaluation.suggestions || []).forEach((s) => {
      const moLines = doc.splitTextToSize(s.missed_opportunity || '', CONTENT_W - 24)
      const promptLines = (s.example_prompts || []).map(p => `• "${p}"`)
      const promptWrappedLines = promptLines.flatMap(p => doc.splitTextToSize(p, CONTENT_W - 28))
      const cardH = moLines.length * 11 + (promptWrappedLines.length ? promptWrappedLines.length * 11 + 22 : 0) + 50
      ensureSpace(cardH)

      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...LIGHT_GRAY)
      doc.rect(MARGIN_X, y, CONTENT_W, cardH, 'FD')
      doc.setFillColor(...SOFT_BLUE)
      doc.rect(MARGIN_X, y, 4, cardH, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...GRAY)
      doc.text(`${(s.competency_name || '').toUpperCase()}  ·  ${s.code}`, MARGIN_X + 16, y + 14)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...NAVY)
      const titleLines = doc.splitTextToSize(s.statement_title || '', CONTENT_W - 24)
      doc.text(titleLines, MARGIN_X + 16, y + 28)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...TEXT)
      const moY = y + 28 + titleLines.length * 11 + 4
      doc.text(moLines, MARGIN_X + 16, moY)

      if (promptWrappedLines.length) {
        const pY = moY + moLines.length * 11 + 10
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...NAVY)
        doc.text('Example prompts the coach could have used:', MARGIN_X + 16, pY)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(...GRAY)
        doc.text(promptWrappedLines, MARGIN_X + 20, pY + 12)
      }

      y += cardH + 10
    })
  }

  const addFooters = () => {
    const total = doc.internal.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
      doc.setPage(i)
      doc.setDrawColor(...LIGHT_GRAY)
      doc.setLineWidth(0.5)
      doc.line(MARGIN_X, PAGE_H - 38, PAGE_W - MARGIN_X, PAGE_H - 38)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...GRAY)
      doc.text(
        'GENERATED BY THE COACHRICE ICF ACC ASSESSOR  ·  DOERR INSTITUTE FOR NEW LEADERS  ·  CALIBRATED TO ICF BARS ' + (assessment.assessor_type === '2025' ? 'NOV 2025' : 'MARCH 2024'),
        PAGE_W / 2,
        PAGE_H - 26,
        { align: 'center' }
      )
      doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN_X, PAGE_H - 26, { align: 'right' })
    }
  }

  drawCoverHeader()
  drawScoreBox()
  drawEthicalPractice()
  drawCompetency2()
  drawBehavioralStatements()
  drawScoreCalculation()
  drawStrengths()
  drawSuggestions()
  addFooters()

  const filename = `Assessment_${assessment.id}.pdf`
  const pdfBlob = doc.output('blob')
  const blobUrl = URL.createObjectURL(pdfBlob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
}
