import { Skeleton } from "@/components/ui/skeleton";

export function MarketCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-zinc-800" />
            <Skeleton className="h-3 w-12 bg-zinc-800" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full bg-zinc-800" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-8 bg-zinc-800" />
            <Skeleton className="h-5 w-16 bg-zinc-800" />
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg bg-zinc-800" />
        <Skeleton className="h-10 flex-1 rounded-lg bg-zinc-800" />
      </div>
    </div>
  );
}
