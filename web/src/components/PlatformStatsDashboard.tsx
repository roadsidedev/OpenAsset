"use client";

import { usePlatformStats } from "@/hooks/usePlatformStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Landmark, Shield } from "lucide-react";

function MiniPieChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <span className="text-xs text-muted-foreground">No data</span>;
  }

  const radius = 20;
  const cx = 30;
  const cy = 30;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;
  const segments = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const fraction = d.count / total;
      const dashLength = fraction * circumference;
      const dashOffset = -accumulated * circumference;
      accumulated += fraction;
      return { ...d, dashLength, dashOffset };
    });

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 60 60" className="h-[52px] w-[52px] shrink-0">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/30" />
        {segments.map((seg) => (
          <circle
            key={seg.label}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            {d.label} ({d.count})
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlatformStatsDashboard() {
  const { data, isLoading } = usePlatformStats();

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[160px] shrink-0 rounded-2xl border border-border bg-card p-4 md:min-w-0">
            <Skeleton className="h-3.5 w-24 bg-muted mb-2.5" />
            <Skeleton className="h-7 w-16 bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Active Markets",
      value: data?.totalActiveMarkets ?? 0,
      icon: Layers,
      color: "text-ice-600 dark:text-ice-400",
    },
    {
      label: "Active Loans",
      value: data?.totalActiveLoans ?? 0,
      icon: Landmark,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Collateral",
      value: data?.totalCollateral ?? "$0",
      icon: Shield,
      color: "text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="min-w-[160px] shrink-0 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-ice-300/30 md:min-w-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">{stat.label}</span>
            </div>
            <div className={`text-xl font-bold ${stat.color}`}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        );
      })}

      {/* Asset Distribution — mini pie chart card */}
      <div className="min-w-[240px] shrink-0 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-ice-300/30 md:min-w-0">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] text-muted-foreground">Asset Distribution</span>
        </div>
        <MiniPieChart data={data?.assetDistribution ?? []} />
      </div>
    </div>
  );
}
