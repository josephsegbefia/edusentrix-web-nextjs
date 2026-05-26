import { cn } from "@/lib/utils";

/** Primary glass card — matches `/admin/students` premium surfaces. */
export const glassPanelClass =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl";

export const glassPanelTopShineClass =
  "pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent";

export const glassPanelGlowTealClass =
  "pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl";

export const glassPanelGlowCyanClass =
  "pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl";

/** Nested fields, empty states, inset rows. */
export const glassInsetClass =
  "rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm";

export const glassPrimaryButtonClass =
  "border border-teal-400/30 bg-teal-500/20 text-teal-100 hover:bg-teal-500/30";

export const glassSecondaryButtonClass =
  "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white";

export function glassPanelCn(...extra: (string | undefined | false)[]) {
  return cn(glassPanelClass, ...extra);
}
