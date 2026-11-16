/** Original SVG illustration: a phone scanning a leaf over a field. */
export default function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 400" className="h-auto w-full" role="img" aria-label="Phone scanning a plant leaf">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dcfce7" /><stop offset="1" stopColor="#f8faf5" /></linearGradient>
        <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22c55e" /><stop offset="1" stopColor="#166534" /></linearGradient>
      </defs>
      <rect x="10" y="20" width="460" height="360" rx="36" fill="url(#sky)" />
      <circle cx="390" cy="85" r="34" fill="#fde68a" />
      <path d="M10 300 C110 260 200 290 270 270 S420 250 470 270 V344 a36 36 0 0 1 -36 36 H46 a36 36 0 0 1 -36 -36z" fill="#bbf7d0" />
      <path d="M10 330 C120 300 220 330 300 312 S430 300 470 312 V344 a36 36 0 0 1 -36 36 H46 a36 36 0 0 1 -36 -36z" fill="#86efac" />
      {[60, 95, 130, 400, 435].map((x, i) => (
        <g key={x} transform={`translate(${x} ${300 + (i % 2) * 8})`}>
          <path d="M0 0 V-34" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />
          <path d="M0 -18 C-14 -22 -18 -34 -16 -40 C-6 -36 0 -28 0 -18Z" fill="#16a34a" />
          <path d="M0 -26 C14 -30 18 -42 16 -48 C6 -44 0 -36 0 -26Z" fill="#22c55e" />
        </g>
      ))}
      {/* big leaf */}
      <g transform="translate(150 95)">
        <path d="M20 190 C10 110 60 30 170 10 C190 110 140 190 20 190Z" fill="url(#leaf)" />
        <path d="M24 186 C70 130 110 80 165 16" stroke="#dcfce7" strokeWidth="4" fill="none" strokeLinecap="round" />
        {[[60, 140, 40, 120], [85, 110, 70, 80], [110, 80, 100, 50], [80, 125, 120, 120], [105, 95, 140, 85]].map(([x1, y1, x2, y2], i) => (
          <path key={i} d={`M${x1} ${y1} L${x2} ${y2}`} stroke="#dcfce7" strokeWidth="2" strokeLinecap="round" opacity=".8" />
        ))}
        <circle cx="70" cy="95" r="9" fill="#a16207" opacity=".85" />
        <circle cx="70" cy="95" r="15" fill="none" stroke="#a16207" strokeWidth="2" opacity=".5" />
        <circle cx="122" cy="132" r="6" fill="#a16207" opacity=".8" />
      </g>
      {/* phone */}
      <g transform="translate(286 120)">
        <rect width="120" height="210" rx="20" fill="#14532d" />
        <rect x="8" y="14" width="104" height="180" rx="12" fill="#f8faf5" />
        <rect x="18" y="26" width="84" height="70" rx="8" fill="#dcfce7" />
        <path d="M30 86 C30 60 50 38 90 34 C92 62 70 84 30 86Z" fill="#22c55e" />
        <circle cx="52" cy="62" r="5" fill="#a16207" />
        <path d="M18 40 V30 a4 4 0 0 1 4 -4 H32 M88 26 H98 a4 4 0 0 1 4 4 V40 M102 82 V92 a4 4 0 0 1 -4 4 H88 M32 96 H22 a4 4 0 0 1 -4 -4 V82" stroke="#166534" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="18" y="108" width="60" height="8" rx="4" fill="#166534" />
        <rect x="18" y="124" width="84" height="6" rx="3" fill="#bbf7d0" />
        <rect x="18" y="124" width="70" height="6" rx="3" fill="#16a34a" />
        <rect x="18" y="140" width="76" height="6" rx="3" fill="#e5e7eb" />
        <rect x="18" y="152" width="58" height="6" rx="3" fill="#e5e7eb" />
        <rect x="18" y="168" width="84" height="16" rx="8" fill="#166534" />
      </g>
      <path d="M260 180 C275 175 280 170 286 165" stroke="#166534" strokeWidth="2" strokeDasharray="4 5" fill="none" />
    </svg>
  );
}
