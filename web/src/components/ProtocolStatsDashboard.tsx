"use client";

import { useProtocolStats, formatTvl } from "@/hooks/useProtocolStats";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendUp, ChartBar, StackSimple, Pulse } from "@phosphor-icons/react";

export function ProtocolStatsDashboard() {
  const { data, isLoading } = useProtocolStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-20 bg-muted mb-2" />
            <Skeleton className="h-8 w-28 bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: "Total Value Locked",
      value: formatTvl(data.tvl),
      icon: TrendUp,
      accent: true,
    },
    {
      label: "Active Markets",
      value: data.activeMarkets.toString(),
      icon: StackSimple,
    },
    {
      label: "Markets Created",
      value: data.totalMarkets.toString(),
      icon: ChartBar,
    },
    {
      label: "Protocol Status",
      value: "Live",
      icon: Pulse,
      live: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-ice-300/30"
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-4 w-4 text-ice-500 dark:text-ice-400" />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xl font-bold tabular-nums ${
                  stat.accent
                    ? "text-ice-600 dark:text-ice-300"
                    : stat.live
                    ? "text-emerald-500"
                    : "text-foreground"
                }`}
              >
                {stat.value}
              </span>
              {stat.live && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
