import { useState } from 'react';
import Layout from '../../components/Layout';

const colors = {
  navy: '#00205B',
  white: '#ffffff',
  gray: '#7C7E7F',
  border: '#e2e6ec',
  orange: '#E8881D',
  skyBlue: '#69cce6',
  softBlue: '#E8F4F8',
};

const fontStack = "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif";

// Mock evaluation data
const mockEvaluation = {
  coach_identifier: "Coach Demo",
  score_calculation: {
    result: "Pass",
    final_score: 3.7,
  },
  ethical_practice: {
    competency_score: 3.5,
    evidence: "Coach demonstrated strong ethical awareness throughout the session."
  },
  coaching_mindset: {
    competency_score: 3.8,
    evidence: "Clear focus on client's agenda and capability development."
  },
  agreements: {
    competency_score: 3.6,
    evidence: "Well-structured coaching session with clear session goals."
  },
  trust_safety: {
    competency_score: 3.9,
    evidence: "Coach created safe, non-judgmental space for exploration."
  },
  presence: {
    competency_score: 3.4,
    evidence: "Coach maintained focus with occasional minor distractions."
  },
  listening: {
    competency_score: 3.7,
    evidence: "Active listening demonstrated with thoughtful pauses."
  },
  awareness: {
    competency_score: 3.8,
    evidence: "Excellent use of powerful questions to evoke awareness."
  },
  growth: {
    competency_score: 3.6,
    evidence: "Client gained insights and identified action steps."
  },
};

const mockBulkResults = [
  {
    filename: "session_john.pdf",
    evaluation: mockEvaluation,
    status: "done",
    downloadFilename: "ACC_Evaluation_session_john",
  },
  {
    filename: "session_mary.txt",
    evaluation: { ...mockEvaluation, score_calculation: { result: "Below Passing", final_score: 2.3 } },
    status: "done",
    downloadFilename: "ACC_Evaluation_session_mary",
  },
  {
    filename: "session_alex.pdf",
    evaluation: mockEvaluation,
    status: "done",
    downloadFilename: "ACC_Evaluation_session_alex",
  },
];

export default function AssessorTest() {
  const [view, setView] = useState("gallery"); // gallery | report
  const [currentResult, setCurrentResult] = useState(null);
  const [currentFilename, setCurrentFilename] = useState("");

  const handleViewReport = (result) => {
    setCurrentResult(result);
    setCurrentFilename(result.filename);
    setView("report");
  };

  if (view === "report" && currentResult) {
    return (
      <Layout active="assessor" pageTitle="Internal Assessor">
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px" }}>
          <button
            onClick={() => setView("gallery")}
            style={{
              marginBottom: "20px",
              backgroundColor: colors.skyBlue,
              color: colors.white,
              border: "none",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: fontStack,
            }}
          >
            Back to Results
          </button>

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "20px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: colors.gray, marginBottom: "6px", letterSpacing: "0.5px", fontFamily: fontStack }}>
                FILE NAME (without extension)
              </label>
              <input
                type="text"
                value={currentFilename.replace(/\.[^/.]+$/, "")}
                readOnly
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "14px",
                  fontFamily: fontStack,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "6px",
                  boxSizing: "border-box",
                  backgroundColor: "#f5f5f5",
                }}
              />
            </div>
          </div>

          <h1 style={{ fontSize: "26px", fontWeight: 700, color: colors.navy, margin: "0 0 8px", letterSpacing: "-0.5px", fontFamily: fontStack }}>
            ACC Performance Evaluation
          </h1>
          <div style={{ fontSize: "14px", color: colors.gray, display: "flex", gap: "24px", flexWrap: "wrap", fontFamily: fontStack }}>
            <span>
              <strong style={{ color: colors.navy }}>Transcript:</strong> {currentFilename}
            </span>
            <span>
              <strong style={{ color: colors.navy }}>Date:</strong> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          <div style={{ marginTop: "32px", padding: "24px", backgroundColor: colors.white, borderRadius: "8px", border: `1px solid ${colors.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: colors.navy, margin: 0, fontFamily: fontStack }}>
                Overall Result
              </h2>
              <div style={{
                fontSize: "18px",
                fontWeight: 700,
                padding: "12px 24px",
                borderRadius: "6px",
                backgroundColor: currentResult.evaluation.score_calculation.result === "Pass" ? "#D1FAE5" : "#FEE2E2",
                color: currentResult.evaluation.score_calculation.result === "Pass" ? "#065F46" : "#7F1D1D",
                fontFamily: fontStack,
              }}>
                {currentResult.evaluation.score_calculation.result === "Pass" ? "PASS" : "BELOW PASSING"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "20px" }}>
              <div style={{ padding: "16px", backgroundColor: colors.softBlue, borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: colors.gray, fontFamily: fontStack }}>Final Score</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: colors.navy, fontFamily: fontStack }}>
                  {currentResult.evaluation.score_calculation.final_score.toFixed(1)}/4.0
                </div>
              </div>
              <div style={{ padding: "16px", backgroundColor: colors.softBlue, borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", color: colors.gray, fontFamily: fontStack }}>Competencies Assessed</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: colors.navy, fontFamily: fontStack }}>8</div>
              </div>
            </div>

            <div style={{ marginTop: "20px", padding: "16px", backgroundColor: "#F0FDF4", borderRadius: "6px", borderLeft: `4px solid #22C55E` }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#166534", marginBottom: "8px", fontFamily: fontStack }}>
                Sample Feedback
              </div>
              <div style={{ fontSize: "13px", color: "#166534", fontFamily: fontStack }}>
                This is a test page showing what the assessment report looks like. Click "Back to Results" to return to the gallery view and try other mock results.
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout active="assessor" pageTitle="Internal Assessor">
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 32px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 700, color: colors.navy, marginBottom: "24px", fontFamily: fontStack }}>
          Test Assessor - Mock Bulk Results
        </h2>

        <p style={{ fontSize: "15px", color: colors.gray, lineHeight: 1.6, margin: "0 0 32px", fontFamily: fontStack }}>
          This is a test page showing the assessor UI with sample data. Click "View" to see the full report, or click "PDF" to preview that button. No API calls are made.
        </p>

        <div style={{ display: "grid", gap: "12px", marginBottom: "32px" }}>
          {mockBulkResults.map((result, idx) => (
            <div key={idx} style={{
              padding: "16px",
              backgroundColor: colors.white,
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ fontWeight: 600, color: colors.navy, fontFamily: fontStack }}>
                  {result.filename}
                </div>
                {result.status === "done" && (
                  <div style={{ fontSize: "13px", color: colors.gray, marginTop: "4px", fontFamily: fontStack }}>
                    {result.evaluation.score_calculation.result} • Score: {result.evaluation.score_calculation.final_score.toFixed(2)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handleViewReport(result)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    backgroundColor: colors.navy,
                    color: colors.white,
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontFamily: fontStack,
                  }}
                >
                  View
                </button>
                <button
                  style={{
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    backgroundColor: colors.navy,
                    color: colors.white,
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontFamily: fontStack,
                  }}
                  onClick={() => alert("PDF download button works - no actual download in test mode")}
                >
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "16px", backgroundColor: "#FEF3C7", borderRadius: "6px", fontFamily: fontStack }}>
          <div style={{ fontSize: "13px", color: "#92400E" }}>
            <strong>Test Mode:</strong> This page uses mock data. Go to the real <a href="/tools/assessor" style={{ color: colors.navy, fontWeight: 600 }}>Assessor (2021)</a> to run actual evaluations.
          </div>
        </div>
      </div>
    </Layout>
  );
}
