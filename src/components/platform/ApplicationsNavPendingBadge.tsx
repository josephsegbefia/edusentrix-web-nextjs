"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { premiumMenuBadge } from "@/components/ui/premium";

export const APPLICATIONS_NAV_PENDING_QUERY_KEY = [
  "applications",
  "navPendingCount",
] as const;

async function fetchPendingCount(): Promise<number> {
  const res = await fetch("/api/platform/applications/nav-badge", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("nav-badge");
  const json = (await res.json()) as {
    success?: boolean;
    data?: { pendingCount?: number };
  };
  if (!json?.success || typeof json.data?.pendingCount !== "number") {
    throw new Error("nav-badge-payload");
  }
  return json.data.pendingCount;
}

/**
 * Unread-style count for platform sidebar: applications with status submitted or reviewed (all time).
 */
export function ApplicationsNavPendingBadge({ collapsed }: { collapsed: boolean }) {
  const { data } = useQuery({
    queryKey: APPLICATIONS_NAV_PENDING_QUERY_KEY,
    queryFn: fetchPendingCount,
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });

  const count = data ?? 0;
  if (count < 1) return null;

  const text = count > 99 ? "99+" : String(count);

  if (collapsed) {
    const collapsedLabel = count > 99 ? "99+" : String(count);
    return (
      <span
        className={cn(
          "pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1",
          "bg-amber-500/90 text-[9px] font-bold leading-none text-black shadow-sm ring-2 ring-[rgba(15,21,36,0.95)]"
        )}
        aria-label={`${count} pending applications`}
      >
        {collapsedLabel}
      </span>
    );
  }

  return (
    <span
      className={cn(premiumMenuBadge, "ml-auto shrink-0 tabular-nums")}
      aria-label={`${count} pending applications`}
    >
      {text}
    </span>
  );
}
