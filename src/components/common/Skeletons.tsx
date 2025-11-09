"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function MetricsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-card/80 border border-white/10 p-4"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16 mt-2" />
          <Skeleton className="h-8 w-fullmt-2" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-card/80 border border-white/10 p-4"
        >
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3 mt-2" />
          <Skeleton className="h-4 w-1/2 mt-2" />
          <Skeleton className="h-8 w-full mt-4" />
        </div>
      ))}
    </div>
  );
}
