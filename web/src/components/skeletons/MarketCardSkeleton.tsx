import { Skeleton } from "@/components/ui/skeleton";

export function MarketCardSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-32 bg-muted" />
            <Skeleton className="h-3 w-24 bg-muted" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full bg-muted" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/50 p-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-14 bg-muted" />
              <Skeleton className="h-4 w-16 bg-muted" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex justify-between">
          <Skeleton className="h-3 w-20 bg-muted" />
          <Skeleton className="h-3 w-16 bg-muted" />
        </div>
      </div>
    </div>
  );
}
