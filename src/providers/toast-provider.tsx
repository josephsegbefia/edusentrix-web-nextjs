"use client";

import { Toaster } from "sonner";

/**
 * Global Sonner host. Styled to match the premium glass workspace UI
 * (matches `glassPanelClass` in `src/lib/ui/glass-surfaces.ts`).
 *
 * NOTE: This intentionally keeps the public Sonner API intact —
 * `toast(...)`, `toast.success(...)`, etc. continue to work as before.
 * Only the visual presentation changes.
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      closeButton
      expand
      theme="dark"
      toastOptions={{
        classNames: {
          toast: [
            "group/glass relative w-[min(94vw,520px)] overflow-hidden",
            "rounded-2xl border border-white/10",
            "bg-linear-to-br from-slate-900/95 via-slate-950/95 to-black",
            "shadow-2xl shadow-black/40 backdrop-blur-xl",
            "text-white px-5 py-4",
            // Top shine line
            "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
            "before:bg-linear-to-r before:from-transparent before:via-white/15 before:to-transparent",
          ].join(" "),
          title: "text-sm font-semibold leading-snug text-white",
          description: "mt-1 text-xs leading-relaxed text-white/70",
          closeButton:
            "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
          actionButton:
            "rounded-lg border border-teal-400/40 bg-teal-500/20 text-teal-100 hover:bg-teal-500/30 text-xs font-semibold px-3 py-1.5",
          cancelButton:
            "rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold px-3 py-1.5",
          success: "border-emerald-500/30",
          error: "border-rose-500/30",
          warning: "border-amber-500/30",
          info: "border-cyan-500/30",
        },
      }}
    />
  );
}
