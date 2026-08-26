"use client";

import { usePlatformStats } from "@/hooks/usePlatformStats";
import { Skeleton } from "@/components/ui/skeleton";
import { StackSimple, Bank, Shield } from "@phosphor-icons/react";
import { AssetDistributionCard } from "@/components/AssetDistributionCard";

export function PlatformStatsDashboard() {
  const { data, isLoading } = usePlatformStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border/70 bg-card p-4">
            <Skeleton className="h-3 w-20 bg-muted mb-3" />
            <Skeleton className="h-6 w-14 bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Active markets",
      value: data?.totalActiveMarkets ?? 0,
      icon: StackSimple,
    },
    {
      label: "Active loans",
      value: data?.totalActiveLoans ?? 0,
      icon: Bank,
    },
    {
      label: "Collateral",
      value: data?.totalCollateral ?? "$0",
      icon: Shield,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="group rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-border hover:bg-card"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {stat.label}
              </span>
            </div>
            <div className="text-[22px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
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
