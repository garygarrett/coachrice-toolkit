export default function LoadingBar() {
  const styles = `
    .cr-loader {
      display: inline-flex;
      align-items: flex-end;
      gap: 14px;
      width: 200px;
      height: 200px;
      justify-content: center;
    }
    .cr-loader span {
      width: 22px;
      height: 120px;
      background: #1B2A5C;
      border-radius: 2px;
      transform-origin: bottom;
      animation: cr-bar-pulse 1.1s ease-in-out infinite;
    }
    .cr-loader span:nth-child(1) { transform: scaleY(0.38); animation-delay: 0s;    }
    .cr-loader span:nth-child(2) { transform: scaleY(1.00); animation-delay: 0.18s; }
    .cr-loader span:nth-child(3) { transform: scaleY(0.64); animation-delay: 0.36s; }

    @keyframes cr-bar-pulse {
      0%, 100% { transform: scaleY(0.55); }
      50%      { transform: scaleY(1);    }
    }

    @media (prefers-reduced-motion: reduce) {
      .cr-loader span { animation: none; }
    }
  `

  return (
    <>
      <style>{styles}</style>
      <div className="cr-loader" role="status" aria-label="Loading">
        <span></span><span></span><span></span>
      </div>
    </>
  )
}
