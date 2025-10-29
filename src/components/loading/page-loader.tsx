"use client";
import { motion } from "framer-motion";

export function PageLoader() {
  return (
    <div className="grid place-items-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-card px-6 py-5 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <div className="text-sm text-muted">Loading…</div>
        </div>
      </motion.div>
    </div>
  );
}
