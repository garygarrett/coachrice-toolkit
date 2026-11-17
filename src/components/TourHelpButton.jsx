// A round "?" button fixed to the bottom right corner. Put it on any page that has a guided tour.
export default function TourHelpButton({ onClick, label = 'Take a quick tour' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{
        position: 'fixed', right: 28, bottom: 24, zIndex: 1500, width: 52, height: 52, borderRadius: '50%', cursor: 'pointer',
        border: '2px solid #fff', background: '#00205B', color: '#fff', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 24, lineHeight: 1,
        boxShadow: '0 4px 14px rgba(0,32,91,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}>
      ?
    </button>
  )
}
