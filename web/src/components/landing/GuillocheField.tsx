"use client";

/**
 * GuillocheField — the signature physics moment of the certificate world.
 * The engraved line-work is strung like instrument wires: the cursor plucks
 * the guilloché bands and they vibrate back into their engraved rest shape
 * with real verlet dynamics (neighbor constraints + rest springs + damping).
 *
 * Discipline: DPR capped at 1.75, sim paused when offscreen or tab hidden,
 * prefers-reduced-motion renders one static frame, canvas is aria-hidden.
 */

import { useEffect, useRef } from "react";

type Pt = { x: number; y: number; px: number; py: number; rx: number; ry: number };

const INK = "20, 37, 29"; // #14251D
const ACCENT = "29, 130, 209"; // engraved blue

export function GuillocheField({
  className,
  bands = 6,
}: {
  className?: string;
  bands?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const POINTS = 96;
    const bandCount = bands;

    let raf = 0;
    let running = false;
    let width = 0;
    let height = 0;

    const strings: Pt[][] = [];
    const pointer = { x: -9999, y: -9999, vx: 0, vy: 0 };

    function restY(band: number, t: number, h: number): number {
      const p = band / bandCount;
      const base = h * (0.16 + 0.68 * p);
      const amp1 = h * 0.05 * (0.55 + 0.85 * ((band % 3) / 2));
      const amp2 = h * 0.018;
      return (
        base +
        amp1 * Math.sin(t * Math.PI * 2 * (1.4 + band * 0.33) + band * 1.7) +
        amp2 * Math.sin(t * Math.PI * 2 * (4.6 + band * 0.85) + band * 0.9)
      );
    }

    function build(): void {
      strings.length = 0;
      for (let b = 0; b < bandCount; b++) {
        const line: Pt[] = [];
        for (let i = 0; i <= POINTS; i++) {
          const t = i / POINTS;
          const x = t * width;
          const y = restY(b, t, height);
          line.push({ x, y, px: x, py: y, rx: x, ry: y });
        }
        strings.push(line);
      }
    }

    function resize(): void {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduced) draw();
    }

    function onMove(e: PointerEvent): void {
      const rect = canvas.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      pointer.vx = nx - pointer.x;
      pointer.vy = ny - pointer.y;
      pointer.x = nx;
      pointer.y = ny;
    }

    function onLeave(): void {
      pointer.x = -9999;
      pointer.y = -9999;
      pointer.vx = 0;
      pointer.vy = 0;
    }

    function step(): void {
      const damp = 0.964;
      const radius = 90;
      for (let b = 0; b < bandCount; b++) {
        const line = strings[b];
        for (let i = 1; i < line.length - 1; i++) {
          const p = line[i];
          let vx = (p.x - p.px) * damp;
          let vy = (p.y - p.py) * damp;
          p.px = p.x;
          p.py = p.y;
          // weak spring back to the engraved rest shape
          vx += (p.rx - p.x) * 0.012;
          vy += (p.ry - p.y) * 0.012;
          // cursor pluck
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < radius * radius) {
            const d = Math.sqrt(d2) || 0.001;
            const f = (1 - d / radius) * 2.6;
            vx += (dx / d) * f + pointer.vx * (1 - d / radius) * 0.26;
            vy += (dy / d) * f + pointer.vy * (1 - d / radius) * 0.26;
          }
          p.x += vx;
          p.y += vy;
        }
        // neighbor distance constraints — keeps the wire continuous
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1];
          const c = line[i];
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const rest = Math.hypot(c.rx - a.rx, c.ry - a.ry);
          const diff = ((dist - rest) / dist) * 0.5;
          if (i > 1) {
            a.x += dx * diff;
            a.y += dy * diff;
          }
          if (i < line.length - 1) {
            c.x -= dx * diff;
            c.y -= dy * diff;
          }
        }
      }
      pointer.vx *= 0.8;
      pointer.vy *= 0.8;
    }

    function draw(): void {
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      for (let b = 0; b < bandCount; b++) {
        const line = strings[b];
        const isAccent = b === 2;
        ctx.beginPath();
        ctx.moveTo(line[0].x, line[0].y);
        for (let i = 1; i < line.length; i++) {
          const p = line[i];
          const q = line[i - 1];
          ctx.quadraticCurveTo(q.x, q.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
        }
        ctx.strokeStyle = isAccent
          ? `rgba(${ACCENT}, 0.30)`
          : `rgba(${INK}, ${(0.2 - b * 0.016).toFixed(3)})`;
        ctx.lineWidth = isAccent ? 1.1 : 0.85;
        ctx.stroke();
      }
    }

    function loop(): void {
      if (!running) return;
      step();
      draw();
      raf = requestAnimationFrame(loop);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        const shouldRun = !!entry.isIntersecting && !document.hidden && !reduced;
        if (shouldRun === running) return;
        running = shouldRun;
        cancelAnimationFrame(raf);
        if (running) raf = requestAnimationFrame(loop);
      },
      { threshold: 0.02 }
    );

    const onVisibility = (): void => {
      if (document.hidden && running) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!document.hidden && !reduced) {
        io.takeRecords();
        running = true;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    if (!reduced) {
      running = true;
      raf = requestAnimationFrame(loop);
    } else {
      draw();
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bands]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
