"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChartPieSlice, ArrowsOutSimple, CaretDown, CaretRight, X } from "@phosphor-icons/react";
import type { AssetCategory } from "@/hooks/usePlatformStats";
import { cn } from "@/lib/utils";

interface AssetDistributionProps {
  data: AssetCategory[];
  isLoading?: boolean;
  error?: string | null;
}

/* ───────────────────────── Donut Math Helpers ───────────────────────── */

function buildArcs(data: AssetCategory[], radius: number) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return { total: 0, arcs: [], circumference: 2 * Math.PI * radius };

  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  const arcs = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const fraction = d.count / total;
      const dashLength = fraction * circumference;
      const offset = -accumulated * circumference;
      accumulated += fraction;
      return { ...d, dashLength, offset, fraction };
    });

  return { total, arcs, circumference };
}

/* ──────────────────────── Inline Mini Donut ──────────────────────── */

function MiniDonut({ data }: { data: AssetCategory[] }) {
  const radius = 20;
  const cx = 30;
  const cy = 30;
  const strokeWidth = 8;
  const { total, arcs, circumference } = buildArcs(data, radius);
  const activeCount = data.filter((d) => d.count > 0).length;

  if (total === 0) {
    return (
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 60 60" className="h-[52px] w-[52px] shrink-0">
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/20" />
        </svg>
        <span className="text-xs text-muted-foreground">No data</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 60 60" className="h-[52px] w-[52px] shrink-0 -rotate-90">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/15" />
        {arcs.map((arc) => (
          <circle
            key={arc.id}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
            strokeDashoffset={arc.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold text-foreground leading-none">{activeCount}</span>
        <span className="text-xs text-muted-foreground">Assets</span>
      </div>
    </div>
  );
}

/* ──────────────────────── Interactive Large Donut ──────────────────────── */

function InteractiveDonut({
  data,
  hoveredSlice,
  onHover,
  onSelect,
  selectedId,
}: {
  data: AssetCategory[];
  hoveredSlice: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}) {
  const radius = 36;
  const cx = 50;
  const cy = 50;
  const strokeWidth = 14;
  const { total, arcs, circumference } = buildArcs(data, radius);

  const activeItem = selectedId
    ? data.find((d) => d.id === selectedId)
    : hoveredSlice
    ? data.find((d) => d.id === hoveredSlice)
    : null;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <svg viewBox="0 0 100 100" className="h-56 w-56 -rotate-90">
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/15" />
        </svg>
        <p className="text-sm text-muted-foreground">No asset data available</p>
      </div>
    );
  }

  return (
    <div className="relative flex justify-center">
      <svg
        viewBox="0 0 100 100"
        className="h-56 w-56 -rotate-90 cursor-pointer"
        onMouseLeave={() => onHover(null)}
      >
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/10" />
        {arcs.map((arc) => {
          const isActive = arc.id === selectedId || arc.id === hoveredSlice;
          const isDimmed = (selectedId || hoveredSlice) && !isActive;
          return (
            <circle
              key={arc.id}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={isActive ? strokeWidth + 3 : strokeWidth}
              strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
              className={cn(
                "transition-all duration-200 ease-out",
                isDimmed && "opacity-30",
                isActive && "drop-shadow-md"
              )}
              style={{
                transform: isActive ? "scale(1.03)" : "scale(1)",
                transformOrigin: "50% 50%",
                transformBox: "fill-box",
              }}
              onMouseEnter={() => onHover(arc.id)}
              onClick={() => onSelect(selectedId === arc.id ? null : arc.id)}
            />
          );
        })}
      </svg>

      {/* Center readout */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center rotate-0">
          {activeItem ? (
            <>
              <p className="text-xs text-muted-foreground leading-tight">{activeItem.name}</p>
              <p className="text-xl font-bold text-foreground leading-tight">{activeItem.percentage}%</p>
              <p className="text-xs text-muted-foreground leading-tight">{activeItem.count} positions</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground leading-tight">{data.length}</p>
              <p className="text-xs text-muted-foreground leading-tight">asset types</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Category List ──────────────────────── */

function CategoryList({
  data,
  expandedId,
  onToggle,
}: {
  data: AssetCategory[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((cat) => {
        const isExpanded = expandedId === cat.id;
        const hasItems = (cat.itemDetails?.length ?? 0) > 0;
        return (
          <div key={cat.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => hasItems && onToggle(cat.id)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                hasItems && "hover:bg-muted/50 cursor-pointer"
              )}
            >
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">{cat.name}</span>
                <span className="text-xs text-muted-foreground">{cat.count} position{cat.count !== 1 ? "s" : ""}</span>
              </span>
              <span className="text-right shrink-0">
                <span className="text-sm font-semibold text-foreground">{cat.count}</span>
                <span className="text-xs text-muted-foreground ml-1">{cat.percentage}%</span>
              </span>
              {hasItems && (
                <span className="text-muted-foreground ml-1">
                  {isExpanded ? <CaretDown className="h-3.5 w-3.5" /> : <CaretRight className="h-3.5 w-3.5" />}
                </span>
              )}
            </button>
            {isExpanded && hasItems && (
              <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-1">
                {cat.itemDetails!.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                    <span className="text-emerald-500">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────── Expanded Modal ──────────────────────── */

function ExpandedModal({
  data,
  onClose,
}: {
  data: AssetCategory[];
  onClose: () => void;
}) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center"
      role="dialog"
      aria-label="Asset Distribution Details"
    >
      {/* Mobile bottom sheet / Desktop centered modal */}
      <div className="relative w-full sm:max-w-lg bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 sm:animate-in sm:fade-in sm:zoom-in-95 sm:duration-200">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <ChartPieSlice className="h-4 w-4 text-ice-500" />
            <h2 className="text-base font-semibold text-foreground">Asset Distribution</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Chart */}
        <div className="px-5 py-4">
          <InteractiveDonut
            data={data}
            hoveredSlice={hoveredSlice}
            onHover={setHoveredSlice}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-5 pb-3">
          {data.filter((d) => d.count > 0).map((cat) => (
            <button
              key={cat.id}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors cursor-pointer",
                selectedId === cat.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              onMouseEnter={() => setHoveredSlice(cat.id)}
              onMouseLeave={() => setHoveredSlice(null)}
              onClick={() => setSelectedId(selectedId === cat.id ? null : cat.id)}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>

        {/* Category List */}
        <div className="px-5 pb-5">
          <CategoryList data={data} expandedId={expandedId} onToggle={(id) => setExpandedId(expandedId === id ? null : id)} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Main Card Component ──────────────────────── */

export function AssetDistributionCard({ data, isLoading, error }: AssetDistributionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const topCategory = [...data].sort((a, b) => b.count - a.count).find((d) => d.count > 0);
  const totalPositions = data.reduce((s, d) => s + d.count, 0);
  const hasData = totalPositions > 0;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-14 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !hasData) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
            <ChartPieSlice className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Distribution</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border bg-muted/40">
            <ChartPieSlice className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No positions yet</p>
            <p className="text-xs text-muted-foreground">Distribution will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="group rounded-2xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-border hover:bg-muted/20"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
              <ChartPieSlice className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Distribution</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <ArrowsOutSimple className="h-3 w-3" />
            Details
          </span>
        </div>

        <div className="flex items-center gap-3">
          <MiniDonut data={data} />

          <div className="flex flex-col gap-1 min-w-0">
            {topCategory && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: topCategory.color }} />
                <span className="text-xs font-medium text-foreground truncate">
                  {topCategory.name} · {topCategory.percentage}%
                </span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {totalPositions} position{totalPositions !== 1 ? "s" : ""} · {data.length} types
            </span>
          </div>
        </div>
      </button>

      {isModalOpen && (
        <ExpandedModal data={data} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
