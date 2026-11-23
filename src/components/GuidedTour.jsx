import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const C = { navy: '#00205B', teal: '#69cce6', gray: '#7C7E7F', border: '#e2e6ec' }
const PAD = 8      // space around the highlighted item
const BUBBLE_W = 360

// Step-by-step pop-ups. Each step is { target?: 'css selector', title, body }.
// A step with no target shows in the middle of the screen. A step whose target is not on the page is skipped.
export default function GuidedTour({ steps, onClose, font = 'Montserrat, sans-serif' }) {
  const [list] = useState(() => steps.filter((s) => !s.target || document.querySelector(s.target)))
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const nextBtn = useRef(null)
  const bubble = useRef(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const step = list[i]
  const last = i === list.length - 1

  useEffect(() => { if (list.length === 0) onClose() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const measure = () => {
    if (!step?.target) { setRect(null); return }
    const el = document.querySelector(step.target)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }

  // Bring the item into view (only when it is not already fully visible), then measure it.
  useLayoutEffect(() => {
    if (step?.target) {
      const el = document.querySelector(step.target)
      if (el) {
        const r = el.getBoundingClientRect()
        const tall = r.height > window.innerHeight * 0.6
        const hidden = r.top < 70 || r.bottom > window.innerHeight - 20
        if (hidden) el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'auto' })
        if (tall && r.top < 70) window.scrollBy(0, -90)
      }
    }
    measure()
    nextBtn.current?.focus()
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = () => { setSize({ w: window.innerWidth, h: window.innerHeight }); measure() }
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true) }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d) => { const n = i + d; if (n < 0) return; if (n >= list.length) { onClose(); return } setI(n) }
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!step) return null

  // Highlight box, clipped to what is visible on screen.
  const hl = rect && {
    top: Math.max(4, rect.top - PAD), left: Math.max(4, rect.left - PAD),
    width: Math.min(size.w - 8, rect.width + PAD * 2), height: Math.min(size.h - 8, rect.height + PAD * 2),
  }
  const tall = hl && hl.height > size.h * 0.55
  const bw = Math.min(BUBBLE_W, size.w - 24)
  const bh = bubble.current?.offsetHeight || 190
  // Bubble position: below the item, else above, else beside it; very tall items get the bubble in the free space beside them.
  let pos = { top: Math.max(12, (size.h - bh) / 2), left: Math.max(12, (size.w - bw) / 2) }
  if (hl && !tall) {
    const cx = Math.min(Math.max(12, hl.left + hl.width / 2 - bw / 2), size.w - bw - 12)
    if (hl.top + hl.height + 14 + bh < size.h) pos = { top: hl.top + hl.height + 14, left: cx }
    else if (hl.top - 14 - bh > 0) pos = { top: hl.top - 14 - bh, left: cx }
    else if (hl.left + hl.width + 14 + bw < size.w) pos = { top: Math.min(Math.max(12, hl.top), size.h - bh - 12), left: hl.left + hl.width + 14 }
    else pos = { top: Math.min(Math.max(12, hl.top), size.h - bh - 12), left: Math.max(12, hl.left - bw - 14) }
  } else if (hl && tall) {
    // Very tall item: put the bubble in the free space beside it, near the bottom; if there is none, over the bottom of the screen.
    const top = Math.max(12, size.h - bh - 18)
    if (hl.left > bw + 28) pos = { top, left: Math.max(12, hl.left - bw - 16) }
    else if (size.w - (hl.left + hl.width) > bw + 28) pos = { top, left: hl.left + hl.width + 16 }
    else pos = { top, left: Math.max(12, (size.w - bw) / 2) }
  }

  const btn = (primary) => ({ fontFamily: font, fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${C.navy}`, background: primary ? C.navy : '#fff', color: primary ? '#fff' : C.navy })

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, fontFamily: font }}>
      {/* Blocks clicks on the page while the tour is open, and dims it */}
      <div style={{ position: 'absolute', inset: 0, background: hl ? 'transparent' : 'rgba(0,32,91,0.55)' }} onClick={(e) => e.stopPropagation()} />
      {hl && <div aria-hidden="true" style={{ position: 'fixed', ...hl, borderRadius: 4, border: `2px solid ${C.teal}`, boxShadow: '0 0 0 9999px rgba(0,32,91,0.55)', pointerEvents: 'none', transition: 'all 0.15s ease' }} />}
      <div ref={bubble} role="dialog" aria-modal="true" aria-label={`Guided tour: ${step.title}`}
        style={{ position: 'fixed', ...pos, width: bw, background: '#fff', borderRadius: 4, padding: '18px 20px 16px', boxShadow: 'none', borderTop: `5px solid ${C.teal}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Step {i + 1} of {list.length}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#0f1c3a' }}>{step.body}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ ...btn(false), border: 'none', color: C.gray, padding: '8px 4px', fontWeight: 600 }}>{last ? 'Close' : 'Skip tour'}</button>
          <span style={{ flex: 1 }} />
          {i > 0 && <button type="button" onClick={() => go(-1)} style={btn(false)}>Back</button>}
          <button type="button" ref={nextBtn} onClick={() => go(1)} style={btn(true)}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
