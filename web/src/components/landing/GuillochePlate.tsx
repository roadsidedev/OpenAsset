/**
  * GuillochePlate: authored background image plate for the certificate world.
 * Deterministic parametric engraving: woven rosettes and hairline bands,
 * the line-work language of stock certificates and banknotes.
 * Server component: renders with or without JavaScript; the live canvas
 * (GuillocheField) draws its physics layer on top of this plate.
 */

function polarPath(
  cx: number,
  cy: number,
  base: number,
  harmonics: Array<{ k: number; a: number; p: number }>,
  samples = 900
): string {
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    let r = base;
    for (const h of harmonics) r += h.a * Math.sin(h.k * t + h.p);
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ") + " Z";
}

function bandPath(
  y0: number,
  width: number,
  amp: number,
  k1: number,
  k2: number,
  phase: number,
  samples = 96
): string {
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = t * width;
    const y =
      y0 +
      amp * Math.sin(t * Math.PI * 2 * k1 + phase) +
      amp * 0.36 * Math.sin(t * Math.PI * 2 * k2 + phase * 1.9);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

export function GuillochePlate({ className }: { className?: string }) {
  // Layered rosette family, right-of-center, like the rosette on a certificate face.
  // Dense high-frequency ripples with small amplitudes: fine woven engraving,
  // not petals. Polar sum: base + harmonics, sampled finely for smoothness.
  const rosettes = [
    { cx: 1180, cy: 470, base: 215, opacity: 0.52, harmonics: [{ k: 36, a: 7, p: 0.0 }, { k: 12, a: 10, p: 1.1 }] },
    { cx: 1180, cy: 470, base: 178, opacity: 0.36, harmonics: [{ k: 44, a: 6, p: 0.5 }, { k: 15, a: 9, p: 2.2 }] },
    { cx: 1180, cy: 470, base: 140, opacity: 0.27, harmonics: [{ k: 54, a: 5, p: 1.0 }, { k: 18, a: 8, p: 0.3 }] },
    { cx: 1180, cy: 470, base: 102, opacity: 0.18, harmonics: [{ k: 64, a: 4, p: 0.7 }, { k: 21, a: 7, p: 1.6 }] },
  ];

  // Woven hairline bands across the full plate
  const bands = [
    { y: 130, amp: 26, k1: 2.2, k2: 6.5, phase: 0.0, o: 0.3 },
    { y: 190, amp: 30, k1: 1.8, k2: 5.2, phase: 0.9, o: 0.24 },
    { y: 820, amp: 26, k1: 2.0, k2: 5.8, phase: 1.6, o: 0.28 },
    { y: 880, amp: 30, k1: 1.6, k2: 4.8, phase: 2.3, o: 0.22 },
  ];

  return (
    <svg
      className={className}
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        {bands.map((b, i) => (
          <path key={`band-${i}`} d={bandPath(b.y, 1600, b.amp, b.k1, b.k2, b.phase)} opacity={b.o} />
        ))}
        {bands.map((b, i) => (
          <path
            key={`band-echo-${i}`}
            d={bandPath(b.y, 1600, b.amp * 0.62, b.k1 * 1.35, b.k2 * 1.3, b.phase + 0.7)}
            opacity={b.o * 0.55}
          />
        ))}
        {rosettes.map((r, i) => (
          <path key={`rosette-${i}`} d={polarPath(r.cx, r.cy, r.base, r.harmonics)} opacity={r.opacity} />
        ))}
        {/* Central rosette core: the certificate seal */}
        <path
          d={polarPath(1180, 470, 58, [{ k: 30, a: 3, p: 0.4 }])}
          opacity={0.42}
        />
        <circle cx="1180" cy="470" r="40" opacity={0.3} />
        <circle cx="1180" cy="470" r="27" opacity={0.26} />
      </g>
    </svg>
  );
}
