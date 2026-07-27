"use client";

import { usePlatformStats } from "@/hooks/usePlatformStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Landmark, Shield } from "lucide-react";

function PieChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const hasData = total > 0;

  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">No market data yet</p>
      </div>
    );
  }

  const radius = 70;
  const cx = 100;
  const cy = 100;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;
  const segments = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const fraction = d.count / total;
      const dashLength = fraction * circumference;
      const dashOffset = -accumulated * circumference;
      accumulated += fraction;
      return { ...d, fraction, dashLength, dashOffset };
    });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 200 200" className="h-[180px] w-[180px]">
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        {/* Data segments */}
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
            className="transition-all duration-500"
          />
        ))}
        {/* Center text */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-foreground text-2xl font-bold"
          style={{ fontSize: '24px', fontWeight: 700 }}
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: '11px' }}
        >
          Total Markets
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">
              {d.label} ({d.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="min-w-[200px] shrink-0 rounded-2xl border border-border bg-card p-5 sm:min-w-0 sm:shrink sm:auto">
      <Skeleton className="h-4 w-28 bg-muted mb-3" />
      <Skeleton className="h-8 w-20 bg-muted" />
    </div>
  );
}

export function PlatformStatsDashboard() {
  const { data, isLoading } = usePlatformStats();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Stat cards skeleton */}
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
          {[1, 2, 3].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-40 bg-muted mb-6" />
          <div className="flex justify-center">
            <Skeleton className="h-[180px] w-[180px] rounded-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Active Markets",
      value: data?.totalActiveMarkets ?? 0,
      icon: Layers,
      color: "text-ice-600 dark:text-ice-400",
    },
    {
      label: "Total Active Loans",
      value: data?.totalActiveLoans ?? 0,
      icon: Landmark,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Total Collateral",
      value: data?.totalCollateral ?? "$0",
      icon: Shield,
      color: "text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards — horizontal scroll on mobile, grid on desktop */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="min-w-[200px] shrink-0 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-ice-300/30 sm:min-w-0 sm:shrink sm:auto"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {typeof stat.value === "number"
                  ? stat.value.toLocaleString()
                  : stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pie chart card */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-5">
          Asset Distribution
        </h3>
        <PieChart data={data?.assetDistribution ?? []} />
      </div>
    </div>
  );
}
