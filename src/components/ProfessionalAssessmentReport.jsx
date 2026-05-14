import React, { useRef } from 'react'

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
  'pass-green': '#16a34a',
  'fail-red': '#dc2626',
}

const competencyTitles = {
  3: 'Establishes and Maintains Agreements',
  4: 'Cultivates Trust and Safety',
  5: 'Maintains Presence',
  6: 'Listens Actively',
  7: 'Evokes Awareness',
  8: 'Facilitates Client Growth',
}

function ratingColor(rating) {
  const colors = {
    'Exceeds the Standard': '#dbeafe',
    'Extremely Proficient': '#dbeafe',
    'Meets the Standard': '#dcfce7',
    'Proficient': '#dcfce7',
    'Below the Standard': '#fed7aa',
    'Sufficient': '#fed7aa',
    'Does Not Meet Standard': '#fee2e2',
  }
  return colors[rating] || '#f3f4f6'
}

function ratingBorderColor(rating) {
  const colors = {
    'Exceeds the Standard': '#0ea5e9',
    'Extremely Proficient': '#0ea5e9',
    'Meets the Standard': '#22c55e',
    'Proficient': '#22c55e',
    'Below the Standard': '#f97316',
    'Sufficient': '#f97316',
    'Does Not Meet Standard': '#ef4444',
  }
  return colors[rating] || '#d1d5db'
}

export function ProfessionalAssessmentReport({ assessment }) {
  const printRef = useRef(null)

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=900,height=1200')
    printWindow.document.write(printRef.current.innerHTML)
    printWindow.document.close()

    // Wait for content to render, then print
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const evaluation = assessment.assessment_data || {}
  const groupedStatements = {}

  ;(evaluation.behavioral_statements || []).forEach((s) => {
    const c = parseInt(s.code.split('.')[0], 10)
    if (!groupedStatements[c]) groupedStatements[c] = []
    groupedStatements[c].push(s)
  })

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const sc = evaluation.score_calculation || {}
  const isPass = sc.result === 'Pass'

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={handlePrint}
          style={{
            padding: '10px 20px',
            backgroundColor: COLORS.navy,
            color: COLORS.white,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          📥 Download as PDF
        </button>
      </div>

      <div
        ref={printRef}
        style={{
          fontFamily: "'Montserrat', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          lineHeight: '1.6',
          color: COLORS['text-main'],
          backgroundColor: COLORS.white,
        }}
      >
        <style>{`
          @media print {
            body {
              margin: 0;
              padding: 0;
              font-family: 'Montserrat', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .print-container {
              page-break-inside: avoid;
              margin: 0;
              padding: 0;
            }
            .section-break {
              page-break-inside: avoid;
            }
            .score-box {
              page-break-inside: avoid;
            }
            .competency-section {
              page-break-inside: avoid;
            }
          }
        `}</style>

        <div className="print-container" style={{ padding: '48px', maxWidth: '900px' }}>
          {/* Header */}
          <div
            style={{
              borderBottom: `4px solid ${COLORS.navy}`,
              paddingBottom: '20px',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                letterSpacing: '2.5px',
                color: COLORS.gray,
                fontWeight: 600,
                marginBottom: '8px',
              }}
            >
              DOERR INSTITUTE FOR NEW LEADERS · COACHRICE LEVEL 1
            </div>
            <h1
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: COLORS.navy,
                margin: '0 0 12px',
                letterSpacing: '-0.5px',
              }}
            >
              ACC Performance Evaluation
            </h1>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
                fontSize: '13px',
                color: COLORS.gray,
              }}
            >
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: COLORS.navy, marginBottom: '4px' }}>
                  Coach
                </div>
                <div>{evaluation.coach_identifier || 'Submitted Coach'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: COLORS.navy, marginBottom: '4px' }}>
                  Date
                </div>
                <div>{dateStr}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: COLORS.navy, marginBottom: '4px' }}>
                  Rubric
                </div>
                <div>ICF ACC BARS ({assessment.assessor_type === '2025' ? 'Nov 2025' : 'March 2024'})</div>
              </div>
            </div>
            {assessment.transcript_filename && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: COLORS.gray }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: COLORS.navy, marginBottom: '4px' }}>
                  Transcript
                </div>
                <div>{assessment.transcript_filename}</div>
              </div>
            )}
          </div>

          {/* Score Box */}
          <div
            className="score-box"
            style={{
              backgroundColor: isPass ? '#f0fdf4' : '#fef2f2',
              border: `2px solid ${isPass ? '#86efac' : '#fca5a5'}`,
              borderRadius: '8px',
              padding: '28px',
              marginBottom: '32px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: COLORS.gray, marginBottom: '8px' }}>
                FINAL SCORE
              </div>
              <div style={{ fontSize: '48px', fontWeight: 700, color: COLORS.navy, marginBottom: '8px' }}>
                {(sc.final_score ?? 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '11px', color: COLORS.gray }}>Pass threshold: 3.40</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: isPass ? COLORS['pass-green'] : COLORS['fail-red'],
                  color: COLORS.white,
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '14px',
                  letterSpacing: '1px',
                }}
              >
                {isPass ? 'PASS' : 'BELOW PASSING'}
              </div>
            </div>
          </div>

          {/* Competency Sections */}
          {[3, 4, 5, 6, 7, 8].map((competency) => (
            <div key={competency} className="competency-section" style={{ marginBottom: '32px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  borderBottom: `2px solid ${COLORS.navy}`,
                  paddingBottom: '8px',
                  marginBottom: '16px',
                }}
              >
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: COLORS.navy,
                    margin: 0,
                    letterSpacing: '-0.2px',
                  }}
                >
                  Competency {competency}: {competencyTitles[competency]}
                </h2>
              </div>

              {groupedStatements[competency] && groupedStatements[competency].length > 0 ? (
                <div>
                  {groupedStatements[competency].map((statement) => (
                    <div
                      key={statement.code}
                      style={{
                        marginBottom: '16px',
                        padding: '12px',
                        backgroundColor: ratingColor(statement.rating),
                        borderLeft: `4px solid ${ratingBorderColor(statement.rating)}`,
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 600, color: COLORS.navy, fontSize: '13px' }}>
                          {statement.code}
                        </div>
                        <div style={{ fontWeight: 600, color: COLORS.navy, fontSize: '13px' }}>
                          {(statement.score ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', marginBottom: '8px', color: COLORS['text-main'] }}>
                        {statement.statement_title}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: COLORS.gray,
                          fontWeight: 500,
                          marginBottom: '8px',
                        }}
                      >
                        Rating: {statement.rating}
                      </div>
                      {statement.qualifiers && statement.qualifiers.length > 0 && (
                        <div style={{ fontSize: '11px', color: COLORS.gray, marginBottom: '8px' }}>
                          <strong>Qualifiers:</strong> {statement.qualifiers.join(', ')}
                        </div>
                      )}
                      {statement.justification && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: COLORS['text-muted'],
                            fontStyle: 'italic',
                            paddingTop: '8px',
                            borderTop: `1px solid ${COLORS['gray-border']}`,
                          }}
                        >
                          {statement.justification}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}

          {/* Strengths */}
          {evaluation.strengths && evaluation.strengths.length > 0 && (
            <div className="section-break" style={{ marginBottom: '32px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  borderBottom: `2px solid ${COLORS.navy}`,
                  paddingBottom: '8px',
                  marginBottom: '16px',
                }}
              >
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: COLORS.navy,
                    margin: 0,
                  }}
                >
                  Identified Strengths
                </h2>
              </div>
              {evaluation.strengths.map((strength, idx) => (
                <div key={idx} style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, color: COLORS.navy, fontSize: '13px', marginBottom: '4px' }}>
                    {strength.code}: {strength.statement_title}
                  </div>
                  <div style={{ fontSize: '12px', color: COLORS['text-main'] }}>
                    {strength.explanation}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Growth Areas */}
          {evaluation.suggestions && evaluation.suggestions.length > 0 && (
            <div className="section-break" style={{ marginBottom: '32px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  borderBottom: `2px solid ${COLORS.navy}`,
                  paddingBottom: '8px',
                  marginBottom: '16px',
                }}
              >
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: COLORS.navy,
                    margin: 0,
                  }}
                >
                  Identified Growth Areas
                </h2>
              </div>
              {evaluation.suggestions.map((suggestion, idx) => (
                <div key={idx} style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 600, color: COLORS.navy, fontSize: '13px', marginBottom: '4px' }}>
                    {suggestion.code}: {suggestion.statement_title}
                  </div>
                  <div style={{ fontSize: '12px', color: COLORS['text-main'] }}>
                    {suggestion.missed_opportunity}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              marginTop: '48px',
              paddingTop: '16px',
              borderTop: `1px solid ${COLORS['gray-border']}`,
              fontSize: '10px',
              color: COLORS.gray,
              textAlign: 'center',
            }}
          >
            <div>CoachRICE Internal Assessor Report</div>
            <div>Generated on {dateStr}</div>
          </div>
        </div>
      </div>
    </>
  )
}
