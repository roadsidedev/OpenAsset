"use client";

import { usePlatformStats } from "@/hooks/usePlatformStats";
import { Skeleton } from "@/components/ui/skeleton";
import { StackSimple, Bank, Shield } from "@phosphor-icons/react";
import { AssetDistributionCard } from "@/components/AssetDistributionCard";

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
      icon: StackSimple,
      color: "text-ice-600 dark:text-ice-400",
    },
    {
      label: "Active Loans",
      value: data?.totalActiveLoans ?? 0,
      icon: Bank,
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Collateral",
      value: data?.totalCollateral ?? "$0",
      icon: Shield,
      color: "text-ice-600 dark:text-ice-400",
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
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className={`text-xl font-bold tabular-nums ${stat.color}`}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        );
      })}

      {/* Asset Distribution — interactive donut chart card */}
      <AssetDistributionCard
        data={data?.assetCategories ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
