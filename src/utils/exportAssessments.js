import * as XLSX from 'xlsx'

export function exportAssessmentsToExcel(assessments) {
  if (!assessments || assessments.length === 0) {
    alert('No assessments to export')
    return
  }

  // Define behavioral statements for both 2021 and 2025 versions
  const statements2021 = [
    { code: '3.1', competency: 3 },
    { code: '3.2', competency: 3 },
    { code: '3.3', competency: 3 },
    { code: '3.4', competency: 3 },
    { code: '4.1', competency: 4 },
    { code: '4.2', competency: 4 },
    { code: '4.3', competency: 4 },
    { code: '5.1', competency: 5 },
    { code: '5.2', competency: 5 },
    { code: '5.3', competency: 5 },
    { code: '6.1', competency: 6 },
    { code: '6.2', competency: 6 },
    { code: '6.3', competency: 6 },
    { code: '7.1', competency: 7 },
    { code: '7.2', competency: 7 },
    { code: '7.3', competency: 7 },
    { code: '8.1', competency: 8 },
    { code: '8.2', competency: 8 },
    { code: '8.3', competency: 8 },
  ]

  const statements2025 = [
    { code: 'A3.1', competency: 3 },
    { code: 'A3.2', competency: 3 },
    { code: 'A3.3', competency: 3 },
    { code: 'A3.4', competency: 3 },
    { code: 'A4.1', competency: 4 },
    { code: 'A4.2', competency: 4 },
    { code: 'A4.3', competency: 4 },
    { code: 'A5.1', competency: 5 },
    { code: 'A5.2', competency: 5 },
    { code: 'A5.3', competency: 5 },
    { code: 'A5.4', competency: 5 },
    { code: 'A6.1', competency: 6 },
    { code: 'A6.2', competency: 6 },
    { code: 'A6.3', competency: 6 },
    { code: 'A7.1', competency: 7 },
    { code: 'A7.2', competency: 7 },
    { code: 'A7.3', competency: 7 },
    { code: 'A8.1', competency: 8 },
    { code: 'A8.2', competency: 8 },
    { code: 'A8.3', competency: 8 },
  ]

  // Prepare rows
  const rows = []

  // Create header row
  const headerRow = [
    'Transcript Name',
    'Date of Assessment',
    'Total Score',
    'Competency 3 Average',
    '3.1',
    '3.2',
    '3.3',
    '3.4',
    'Competency 4 Average',
    '4.1',
    '4.2',
    '4.3',
    'Competency 5 Average',
    '5.1',
    '5.2',
    '5.3',
    'Competency 6 Average',
    '6.1',
    '6.2',
    '6.3',
    'Competency 7 Average',
    '7.1',
    '7.2',
    '7.3',
    'Competency 8 Average',
    '8.1',
    '8.2',
    '8.3',
    'Identified Strengths',
    'Identified Growth Areas',
  ]

  rows.push(headerRow)

  // Process each assessment
  assessments.forEach(assessment => {
    const data = assessment.assessment_data || {}
    const transcriptName = assessment.transcript_filename || 'Unknown'
    const assessmentDate = new Date(assessment.created_at)
    const formattedDate = `${String(assessmentDate.getMonth() + 1).padStart(2, '0')}/${String(assessmentDate.getDate()).padStart(2, '0')}/${assessmentDate.getFullYear()}`

    // Get the statements based on assessor type
    const statements = assessment.assessor_type === '2025' ? statements2025 : statements2021

    // Extract individual scores
    const scores = {}
    if (data.behavioral_statements && Array.isArray(data.behavioral_statements)) {
      data.behavioral_statements.forEach(stmt => {
        if (stmt.code && stmt.score !== undefined && stmt.score !== null) {
          scores[stmt.code] = stmt.score
        }
      })
    }

    // Calculate competency averages
    const competencyAverages = {}
    for (let comp = 3; comp <= 8; comp++) {
      const statementsForComp = statements.filter(s => s.competency === comp)
      const validScores = statementsForComp
        .map(s => scores[s.code])
        .filter(score => score !== undefined && score !== null && !isNaN(score))

      if (validScores.length > 0) {
        competencyAverages[comp] = (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)
      } else {
        competencyAverages[comp] = ''
      }
    }

    // Combine strengths
    const strengthsText = (data.strengths || [])
      .map(s => `${s.code} - ${s.statement_title}: ${s.explanation}`)
      .join('\n\n')

    // Combine suggestions
    const suggestionsText = (data.suggestions || [])
      .map(s => `${s.code} - ${s.statement_title}: ${s.missed_opportunity}`)
      .join('\n\n')

    // Build row
    const row = [
      transcriptName,
      formattedDate,
      data.score_calculation?.final_score !== undefined ? (data.score_calculation.final_score).toFixed(2) : '',
    ]

    // Add competency averages and individual scores
    for (let comp = 3; comp <= 8; comp++) {
      row.push(competencyAverages[comp] || '')
      const statementsForComp = statements.filter(s => s.competency === comp)
      statementsForComp.forEach(stmt => {
        row.push(scores[stmt.code] !== undefined ? scores[stmt.code] : '')
      })
    }

    // Add strengths and suggestions
    row.push(strengthsText)
    row.push(suggestionsText)

    rows.push(row)
  })

  // Create workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Set column widths
  const colWidths = [
    { wch: 25 }, // Transcript Name
    { wch: 15 }, // Date
    { wch: 12 }, // Total Score
    { wch: 18 }, // Comp 3 Avg
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 18 }, // Comp 4 Avg
    { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 18 }, // Comp 5 Avg
    { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 18 }, // Comp 6 Avg
    { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 18 }, // Comp 7 Avg
    { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 18 }, // Comp 8 Avg
    { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 40 }, // Strengths
    { wch: 40 }, // Growth Areas
  ]
  ws['!cols'] = colWidths

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  XLSX.utils.book_append_sheet(wb, ws, 'Assessments')
  XLSX.writeFile(wb, `CoachRICE_Assessments_${new Date().toISOString().split('T')[0]}.xlsx`)
}
