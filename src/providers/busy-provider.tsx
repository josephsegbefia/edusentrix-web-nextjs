"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

type BusyCtx = {
  /** Manually increment/decrement when wrapping arbitrary promises */
  beginBusy: () => void;
  endBusy: () => void;
  /** True when React Query is fetching/mutating OR manual busy > 0 */
  isBusy: boolean;
};

const Ctx = createContext<BusyCtx | null>(null);

export function BusyProvider({ children }: { children: React.ReactNode }) {
  const [manualCount, setManualCount] = useState(0);

  // React Query mutations - always show overlay for mutations
  const mutating = useIsMutating();

  // Count only initial fetches (queries without cached data)
  // Background refetches (queries with cached data) should NOT show overlay
  const initialFetches = useIsFetching({
    predicate: (query) => {
      // Only count as "busy" if query is fetching AND has no cached data
      // This distinguishes initial fetches from background refetches
      const hasCachedData =
        query.state.data !== undefined && query.state.data !== null;
      // In React Query v5, use fetchStatus instead of isFetching()
      const isFetching = query.state.fetchStatus === "fetching";

      // Show overlay only for initial fetches (no cached data)
      // Background refetches (has cached data) won't trigger overlay
      return isFetching && !hasCachedData;
    },
  });

  // Only show overlay for mutations, initial fetches, or manual busy states
  // Background refetches (queries with cached data) won't trigger overlay
  const rqBusy = initialFetches + mutating > 0;
  const isBusy = rqBusy || manualCount > 0;

  // Prevent background scroll while busy (overlay blocks clicks)
  useEffect(() => {
    if (isBusy) {
      document.body.classList.add("overflow-hidden");
      // Prevent focus on any element behind the overlay
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
    } else {
      document.body.classList.remove("overflow-hidden");
    }
  }, [isBusy]);

  const value = useMemo<BusyCtx>(
    () => ({
      beginBusy: () => setManualCount((n) => n + 1),
      endBusy: () => setManualCount((n) => Math.max(0, n - 1)),
      isBusy,
    }),
    [isBusy]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {isBusy && (
          <motion.div
            key="busy-overlay"
            data-busy-overlay
            className="fixed inset-0 z-9999 grid place-items-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ pointerEvents: "auto" }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              // Prevent all keyboard input when busy (except Escape which is handled by modals)
              if (e.key !== "Escape") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            tabIndex={-1}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-2xl border border-white/10 bg-card px-6 py-5 shadow-2xl pointer-events-none"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <div className="text-sm text-muted">Working… please wait</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

export function useBusy() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBusy must be used within BusyProvider");
  return ctx;
}
