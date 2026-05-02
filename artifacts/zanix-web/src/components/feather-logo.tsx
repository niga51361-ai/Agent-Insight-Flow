export default function FeatherLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = "fl";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zanix logo"
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="8" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(260,84%,78%)" />
          <stop offset="55%" stopColor="hsl(220,90%,68%)" />
          <stop offset="100%" stopColor="hsl(186,100%,58%)" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="12" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(260,84%,78%)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="hsl(186,100%,60%)" stopOpacity="0.22" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── Vane body (filled silhouette) ── */}
      <path
        d="M44 8 C50 12 54 20 52 30 C50 40 42 50 32 56 C30 50 28 44 28 38 C28 32 30 26 32 22 C34 18 36 14 40 10 Z"
        fill={`url(#${id}-b)`}
      />

      {/* ── Rachis / spine ── */}
      <path
        d="M44 8 Q36 28 24 56"
        stroke={`url(#${id}-a)`}
        strokeWidth="2.2"
        strokeLinecap="round"
        filter={`url(#${id}-glow)`}
      />

      {/* ── Barbs right side (fanning up-right from spine) ── */}
      <path d="M43.5 9.5  Q47 13 49 16"   stroke={`url(#${id}-a)`} strokeWidth="1.05" strokeLinecap="round" opacity="0.95"/>
      <path d="M42 12    Q46 16 48 20"    stroke={`url(#${id}-a)`} strokeWidth="0.95" strokeLinecap="round" opacity="0.88"/>
      <path d="M40.5 15  Q45 19 47 23"   stroke={`url(#${id}-a)`} strokeWidth="0.88" strokeLinecap="round" opacity="0.80"/>
      <path d="M39 18.5  Q43.5 22 45 27" stroke={`url(#${id}-a)`} strokeWidth="0.80" strokeLinecap="round" opacity="0.72"/>
      <path d="M37.5 22  Q42 26 43 31"   stroke={`url(#${id}-a)`} strokeWidth="0.72" strokeLinecap="round" opacity="0.63"/>
      <path d="M36 25.5  Q40 30 41 35"   stroke={`url(#${id}-a)`} strokeWidth="0.64" strokeLinecap="round" opacity="0.54"/>
      <path d="M34 29.5  Q38 34 38.5 39" stroke={`url(#${id}-a)`} strokeWidth="0.56" strokeLinecap="round" opacity="0.44"/>
      <path d="M32 33.5  Q35.5 38 36 43" stroke={`url(#${id}-a)`} strokeWidth="0.48" strokeLinecap="round" opacity="0.34"/>

      {/* ── Barbs left side (fanning down-left from spine) ── */}
      <path d="M42.5 11.5 Q39 14 37 17"  stroke={`url(#${id}-a)`} strokeWidth="1.05" strokeLinecap="round" opacity="0.92"/>
      <path d="M41 14.5  Q37 17 35 21"   stroke={`url(#${id}-a)`} strokeWidth="0.95" strokeLinecap="round" opacity="0.84"/>
      <path d="M39.5 18  Q35 21 33 25"   stroke={`url(#${id}-a)`} strokeWidth="0.88" strokeLinecap="round" opacity="0.76"/>
      <path d="M38 21.5  Q33 25 31 29"   stroke={`url(#${id}-a)`} strokeWidth="0.80" strokeLinecap="round" opacity="0.67"/>
      <path d="M36.5 25  Q31.5 29 29 33" stroke={`url(#${id}-a)`} strokeWidth="0.72" strokeLinecap="round" opacity="0.58"/>
      <path d="M35 28.5  Q30 33 28 37"   stroke={`url(#${id}-a)`} strokeWidth="0.64" strokeLinecap="round" opacity="0.49"/>
      <path d="M33 32.5  Q28 37 26 41"   stroke={`url(#${id}-a)`} strokeWidth="0.56" strokeLinecap="round" opacity="0.39"/>
      <path d="M31 36.5  Q26.5 41 25 45" stroke={`url(#${id}-a)`} strokeWidth="0.48" strokeLinecap="round" opacity="0.30"/>

      {/* ── Calamus tip (quill nib) ── */}
      <path
        d="M24 56 Q22 59 20 61"
        stroke={`url(#${id}-a)`}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.50"
      />
      <path
        d="M24 56 Q26 59 25.5 61"
        stroke={`url(#${id}-a)`}
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.28"
      />
      <circle cx="24" cy="56" r="1.6" fill={`url(#${id}-a)`} opacity="0.65" />
    </svg>
  );
}
