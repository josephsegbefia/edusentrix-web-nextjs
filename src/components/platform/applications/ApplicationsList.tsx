"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ApplicationCard, { Application } from "./ApplicationCard";
import ApplicationDrawer from "./ApplicationDrawer";

type Page = { items: Application[]; nextCursor?: string | null };

function useFilters() {
  const s = useSearchParams();
  return useMemo(
    () => ({
      status: s.get("status") ?? "all",
      type: s.get("type") ?? undefined,
      q: s.get("q") ?? undefined,
      range: s.get("range") ?? "30d",
    }),
    [s]
  );
}

export default function ApplicationsList() {
  const filters = useFilters();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryKey = useMemo(
    () => ["applications:list", filters] as const,
    [filters]
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      if (filters.status && filters.status !== "all")
        params.set("status", filters.status);
      if (filters.type && filters.type !== "all")
        params.set("type", filters.type);
      if (filters.q) params.set("q", filters.q);
      if (filters.range) params.set("range", filters.range);
      params.set("limit", "20");

      const res = await fetch(
        `/api/platform/applications?${params.toString()}`,
        {
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error("list");
      const payload = await res.json();
      // API returns {success, data, {items, nextCursor}}
      if (!payload?.success || !payload?.data) {
        throw new Error("bad-payload");
      }
      return payload.data as Page;
    },
    getNextPageParam: (last) => last.nextCursor ?? null,
  });

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        void fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage]);

  const items = (data?.pages ?? []).flatMap((p) =>
    Array.isArray(p?.items) ? p.items : []
  ) as Application[];
  const activeStatus =
    filters.status === "pending" ||
    filters.status === "approved" ||
    filters.status === "rejected"
      ? filters.status
      : "all";

  return (
    <>
      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-card/70 p-10 text-center">
          <div className="text-xl font-medium">No applications found</div>
          <div className="text-muted mt-1">
            Try adjusting filters or date range.
          </div>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Grid of cards */}
      <AnimatePresence mode="popLayout">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((app, idx) => (
            <motion.div
              key={app._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, delay: Math.min(idx, 6) * 0.02 }}
            >
              <ApplicationCard
                application={app}
                onOpen={() => setSelectedId(app._id)}
                activeStatus={activeStatus}
                queryKey={queryKey}
                // optimistic updates are handled inside the card's mutations
              />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* Load more fallback */}
      {hasNextPage && (
        <div className="flex items-center justify-center mt-4">
          <Button
            variant="secondary"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {/* Intersection observer sentinel */}
      <div ref={sentinelRef} className="h-8" />

      {/* Drawer */}
      <ApplicationDrawer
        open={!!selectedId}
        id={selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </>
  );
}
