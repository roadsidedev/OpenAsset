"use client";

import { usePlatformStats } from "@/hooks/usePlatformStats";
import { Skeleton } from "@/components/ui/skeleton";
import { StackSimple, Bank, Shield } from "@phosphor-icons/react";
import { AssetDistributionCard } from "@/components/AssetDistributionCard";

export function PlatformStatsDashboard() {
  const { data, isLoading } = usePlatformStats();

  if (isLoading) {
    return (
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-4 md:gap-px md:overflow-hidden md:rounded-[24px] md:border md:border-border/70 md:bg-border/60 md:pb-0">
        {[1, 2, 3, 4].map((index) => (
          <div key={index} className="min-h-[110px] min-w-[210px] shrink-0 snap-start rounded-[22px] border border-border/70 bg-card/80 p-5 md:min-w-0 md:rounded-none md:border-0">
            <Skeleton className="mb-3 h-3 w-24 bg-muted" />
            <Skeleton className="h-8 w-16 bg-muted" />
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
      color: "text-ice-600 dark:text-ice-300",
    },
    {
      label: "Active loans",
      value: data?.totalActiveLoans ?? 0,
      icon: Bank,
      color: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Collateral",
      value: data?.totalCollateral ?? "$0",
      icon: Shield,
      color: "text-ice-600 dark:text-ice-300",
    },
  ];

  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-4 md:gap-px md:overflow-hidden md:rounded-[24px] md:border md:border-border/70 md:bg-border/60 md:pb-0">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="group min-h-[110px] min-w-[210px] shrink-0 snap-start rounded-[22px] border border-border/70 bg-card/80 p-5 transition-colors duration-300 hover:bg-card md:min-w-0 md:rounded-none md:border-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              <Icon className="size-3.5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
              <span>{stat.label}</span>
            </div>
            <div className={`mt-4 font-serif text-3xl tracking-tight ${stat.color}`}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        );
      })}

      <div className="min-w-[280px] shrink-0 snap-start rounded-[22px] border border-border/70 bg-card/80 md:min-w-0 md:rounded-none md:border-0 [&>button]:!min-w-0 [&>button]:!rounded-none [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:!p-5 [&>button]:!shadow-none">
        <AssetDistributionCard data={data?.assetCategories ?? []} isLoading={isLoading} />
      </div>
    </div>
  );
}
