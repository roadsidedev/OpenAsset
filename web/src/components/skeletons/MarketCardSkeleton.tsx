import { Skeleton } from "@/components/ui/skeleton";

export function MarketCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-col justify-between h-full space-y-4">
        <div className="space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Skeleton className="h-10 w-10 rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-16 bg-muted" />
                  <Skeleton className="h-4 w-14 rounded-full bg-muted" />
                </div>
                <Skeleton className="h-3 w-24 bg-muted" />
                <Skeleton className="h-2.5 w-32 bg-muted" />
              </div>
            </div>
            <Skeleton className="h-5 w-14 rounded-full bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/40 p-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-14 bg-muted" />
                <Skeleton className="h-3.5 w-16 bg-muted" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between border-t border-border/60 pt-3.5">
          <Skeleton className="h-3 w-20 bg-muted" />
          <Skeleton className="h-3 w-16 bg-muted" />
        </div>
      </div>
    </div>
  );
}
