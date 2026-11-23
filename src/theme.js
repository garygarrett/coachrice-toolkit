// One place for the Doerr brand colors, type and spacing. Components import from here
// instead of keeping their own COLORS constants.
export const COLORS = {
  navy: '#00205B',
  gray: '#7C7E7F',
  white: '#FFFFFF',
  sky: '#69cce6',
  blue: '#78b3e0',
  orange: '#ff8200',
  lime: '#c9d647',
  // neutrals derived from the brand navy
  ink: '#0f1c3a',
  muted: '#5b6785',
  line: '#dfe3ea',
  wash: '#f6f7f9',
  // status
  ok: '#2e7d4f',
  danger: '#b3261e',
}

export const FONT = "Montserrat, Arial, sans-serif"

// 4px spacing scale
export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 }

export const TYPE = {
  h1: { fontSize: 24, fontWeight: 700, color: COLORS.navy, lineHeight: 1.25, letterSpacing: '-0.2px' },
  h2: { fontSize: 18, fontWeight: 700, color: COLORS.navy, lineHeight: 1.3 },
  body: { fontSize: 14, fontWeight: 400, color: COLORS.ink, lineHeight: 1.6 },
  caption: { fontSize: 12, fontWeight: 500, color: COLORS.muted, lineHeight: 1.5 },
}

export const BTN = {
  primary: { background: COLORS.navy, color: '#fff', border: `1px solid ${COLORS.navy}`, borderRadius: 4, padding: '0 20px', minHeight: 44, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  ghost: { background: '#fff', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, borderRadius: 4, padding: '0 20px', minHeight: 44, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  danger: { background: '#fff', color: COLORS.danger, border: `1px solid ${COLORS.danger}`, borderRadius: 4, padding: '0 20px', minHeight: 44, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}
