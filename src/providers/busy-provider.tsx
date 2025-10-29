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

  // React Query global busy state
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const rqBusy = fetching + mutating > 0;

  const isBusy = rqBusy || manualCount > 0;

  // Prevent background scroll while busy (overlay blocks clicks)
  useEffect(() => {
    if (isBusy) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
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
            className="fixed inset-0 z-60 grid place-items-center bg-black/40 backdrop-blur-sm pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-2xl border border-white/10 bg-card px-6 py-5 shadow-2xl"
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
