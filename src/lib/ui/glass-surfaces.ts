import { cn } from "@/lib/utils";

/** Primary glass card. Dark on :root; light inside `.workspace` when the theme is light. */
export const glassPanelClass =
  "relative overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) shadow-[var(--ws-shadow)] backdrop-blur-xl";

export const glassPanelTopShineClass =
  "pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--ws-shine) to-transparent";

export const glassPanelGlowTealClass =
  "pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-(--ws-glow-teal) blur-3xl";

export const glassPanelGlowCyanClass =
  "pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-(--ws-glow-cyan) blur-3xl";

/** Nested fields, empty states, inset rows. */
export const glassInsetClass =
  "rounded-xl border border-(--ws-line) bg-(--ws-fill) backdrop-blur-sm";

export const glassPrimaryButtonClass =
  "border border-teal-400/30 bg-teal-500/20 text-(--ws-teal) hover:bg-teal-500/30";

export const glassSecondaryButtonClass =
  "border border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-80) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)";

export function glassPanelCn(...extra: (string | undefined | false)[]) {
  return cn(glassPanelClass, ...extra);
}
