"use client";

/**
 * AssemblyFlow — the machine inside the certificate.
 * The canonical 8-step creation flow (PRD Feature 1) becomes a scroll-scrubbed
 * assembly: adapter parts fly in with spring dynamics and bolt onto a market
 * cell, each snap revealing one plain-English fact. The finished cell is
 * stamped DEPLOYED — validated in one transaction.
 *
 * Physics: scroll progress is smoothed through a spring (stiffness 130,
 * damping 22); each part's settle runs its own stiffer spring (170/14), so
 * parts overshoot and seat like machined components. Reduced motion renders
 * the assembled end state statically.
 */

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";

type Part = {
  label: string;
  hint: string;
  /** slot position + size inside the cell, percent */
  x: number;
  y: number;
  w: number;
  h: number;
  /** entry direction */
  dx: number;
  rot: number;
  /** activation band on the smoothed scroll progress */
  at: [number, number];
};

const PARTS: Part[] = [
  { label: "COLLATERAL · TOKENIZED ASSET", hint: "contract verified on-chain", x: 6, y: 12, w: 44, h: 15, dx: -70, rot: -6, at: [0.06, 0.16] },
  { label: "ORACLE · UNISWAP TWAP", hint: "flash-loan resistant pricing", x: 52, y: 12, w: 42, h: 15, dx: 70, rot: 5, at: [0.16, 0.26] },
  { label: "COMPLIANCE · OPTIONAL", hint: "eligibility, per market", x: 6, y: 33, w: 44, h: 15, dx: -70, rot: 5, at: [0.26, 0.36] },
  { label: "LIQUIDATION · DEX SWAP", hint: "debt + penalty only", x: 52, y: 33, w: 42, h: 15, dx: 70, rot: -5, at: [0.36, 0.46] },
  { label: "POSITION · SOULBOUND", hint: "non-transferable loan", x: 6, y: 54, w: 44, h: 15, dx: -70, rot: 4, at: [0.46, 0.56] },
  { label: "TERMS · LTV 65% · APR 12%", hint: "set by the market creator", x: 52, y: 54, w: 42, h: 15, dx: 70, rot: -4, at: [0.56, 0.66] },
  { label: "LIQUIDITY · USDC", hint: "isolated to this market", x: 29, y: 74, w: 42, h: 15, dx: 0, rot: 3, at: [0.66, 0.76] },
];

const STEPS = [
  {
    title: "Pick the collateral.",
    copy: "Any tokenized asset on-chain — tokens, NFTs, tokenized stocks. The wizard verifies the contract exists before you sign.",
  },
  {
    title: "Choose how it's priced.",
    copy: "Flash-loan-resistant TWAP for crypto-native tokens; Chainlink equity feeds for tokenized stocks.",
  },
  {
    title: "Set eligibility.",
    copy: "Permissionless by default — or attach a compliance adapter where the asset requires it.",
  },
  {
    title: "Choose how it liquidates.",
    copy: "DEX swap, NFT auction, or issuer redemption. Liquidation only ever takes what the debt requires.",
  },
  {
    title: "Set the terms. Deploy.",
    copy: "LTV, rate, duration, grace period, circuit breaker — your parameters, enforced on-chain. The factory validates every combination and tells you, in plain language, if something won't work.",
  },
];

const STEP_THRESHOLDS = [0.1, 0.26, 0.4, 0.54, 0.7];

function AssemblyPart({
  part,
  progress,
  reduced,
}: {
  part: Part;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const raw = useTransform(progress, part.at, [0, 1]);
  const settle = useSpring(raw, { stiffness: 170, damping: 14, mass: 0.9 });
  const opacity = useTransform(raw, [0, 0.35], [0, 1]);
  const transform = useTransform(settle, (v: number) =>
    reduced || v === 1
      ? "translate(0px, 0px) rotate(0deg)"
      : `translate(${(1 - v) * part.dx}px, ${(1 - v) * 46}px) rotate(${(1 - v) * part.rot}deg)`
  );

  return (
    <motion.div
      className="cert-part"
      style={{
        left: `${part.x}%`,
        top: `${part.y}%`,
        width: `${part.w}%`,
        opacity: reduced ? 1 : opacity,
        transform,
      }}
    >
      <span className="cert-part-label">{part.label}</span>
      <span className="cert-part-hint">{part.hint}</span>
    </motion.div>
  );
}

function DeploymentStamp({
  progress,
  reduced,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const raw = useTransform(progress, [0.82, 0.92], [0, 1]);
  const settle = useSpring(raw, { stiffness: 200, damping: 13 });
  const opacity = useTransform(raw, [0, 0.6], [0, 1]);
  const scale = useTransform(settle, (v: number) => (reduced ? 1 : 0.7 + v * 0.3));

  return (
    <motion.div
      className="cert-stamp"
      style={{
        left: "50%",
        top: "50%",
        translateX: "-50%",
        translateY: "-50%",
        opacity: reduced ? 1 : opacity,
        scale,
      }}
    >
      Deployed · one transaction
    </motion.div>
  );
}

export function AssemblyFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [activeStep, setActiveStep] = useState(reduced ? STEPS.length - 1 : -1);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 130, damping: 22, mass: 1 });

  useMotionValueEvent(smooth, "change", (v: number) => {
    let next = -1;
    for (let i = 0; i < STEP_THRESHOLDS.length; i++) {
      if (v >= STEP_THRESHOLDS[i]) next = i;
    }
    setActiveStep((prev) => (prev === next ? prev : next));
  });

  const statusOpacity = useTransform(smooth, [0.78, 0.88], [0, 1]);
  const cellBorderColor = useTransform(
    smooth,
    [0, 0.8, 0.92],
    ["rgba(20, 37, 29, 0.38)", "rgba(20, 37, 29, 0.38)", "rgba(15, 123, 79, 0.65)"]
  );

  return (
    <div ref={containerRef} className="relative h-[280vh] md:h-[300vh]">
      <div className="sticky top-0 flex min-h-dvh items-center">
        <div className="mx-auto grid w-full max-w-[1160px] items-center gap-10 px-4 md:grid-cols-[1fr_1.05fr] md:gap-14 md:px-6">
          {/* Steps — the deployment sequence */}
          <div>
            <ol className="border-b border-[var(--oa-rule)]">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="cert-step"
                  data-active={reduced ? "true" : activeStep >= i ? "true" : "false"}
                >
                  <span className="cert-step-num">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="cert-step-title">{step.title}</p>
                    <p className="cert-step-copy">{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 max-w-[54ch] text-[13px] leading-relaxed text-[var(--oa-ink-soft)]">
              Pick a tokenized stock and the wizard pre-selects the full stack —
              equity price feed, compliance policy, non-transferable positions,
              DEX liquidation.
            </p>
          </div>

          {/* The market cell */}
          <div>
            <motion.div
              className="cert-cell aspect-[4/3] w-full"
              style={{ borderColor: reduced ? undefined : cellBorderColor }}
            >
              <span className="cert-frame-corner tl" />
              <span className="cert-frame-corner tr" />
              <span className="cert-frame-corner bl" />
              <span className="cert-frame-corner br" />
              <p className="cert-cap absolute left-4 top-3.5">
                Market cell — isolated by construction
              </p>

              {PARTS.map((part) => (
                <span key={part.label} className="cert-slot" style={{ left: `${part.x}%`, top: `${part.y}%`, width: `${part.w}%`, height: `${part.h}%` }} />
              ))}

              {PARTS.map((part) => (
                <AssemblyPart key={part.label} part={part} progress={smooth} reduced={!!reduced} />
              ))}

              <DeploymentStamp progress={smooth} reduced={!!reduced} />
            </motion.div>
            <motion.p
              className="cert-micro mt-4 text-center"
              style={{ opacity: reduced ? 1 : statusOpacity }}
            >
              Validation matrix passed · live on-chain
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}
