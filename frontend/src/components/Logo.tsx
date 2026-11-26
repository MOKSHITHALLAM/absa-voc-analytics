/** INSIGHTVOICE AI mark: a listening arc over a four-bar voice waveform. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="INSIGHTVOICE AI logo">
      <defs>
        <linearGradient id="iv-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4B8DFF" />
          <stop offset="1" stopColor="#5FD4E8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#0E1530" />
      <path d="M14 40c0-10 7-18 18-18s18 8 18 18" fill="none" stroke="url(#iv-g)" strokeWidth="5" strokeLinecap="round" />
      <g fill="url(#iv-g)">
        <rect x="20" y="30" width="4" height="14" rx="2" />
        <rect x="27" y="25" width="4" height="22" rx="2" />
        <rect x="34" y="28" width="4" height="17" rx="2" />
        <rect x="41" y="33" width="4" height="9" rx="2" />
      </g>
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-bold tracking-[0.02em] text-ink">INSIGHTVOICE AI</span>
          <span className="mt-1 block text-[11px] text-ink-3">Hotel ABSA &amp; VoC analytics</span>
        </span>
      )}
    </span>
  );
}
