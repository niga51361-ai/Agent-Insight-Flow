export default function ZanixLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zanix AI"
    >
      <defs>
        <linearGradient id="zx-g1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="zx-g2" x1="48" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
        </linearGradient>
        <filter id="zx-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Hexagon background */}
      <path
        d="M24 3 L41 12.5 L41 31.5 L24 41 L7 31.5 L7 12.5 Z"
        fill="url(#zx-g1)"
        opacity="0.12"
        stroke="url(#zx-g1)"
        strokeWidth="1"
        strokeOpacity="0.4"
      />

      {/* Z letter - bold and sharp */}
      <path
        d="M14 14 L33 14 L15 31 L34 31"
        stroke="url(#zx-g1)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#zx-glow)"
      />

      {/* AI dot - electric cyan accent */}
      <circle cx="36" cy="13" r="3" fill="url(#zx-g2)" opacity="0.95" />
      <circle cx="36" cy="13" r="1.5" fill="#22d3ee" />
    </svg>
  );
}
