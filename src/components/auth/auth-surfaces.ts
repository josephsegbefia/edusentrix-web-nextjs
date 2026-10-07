import type { CSSProperties } from "react";

/** Shared field, button, and shell classes for public auth and enrol flows. */

export const authInputClass =
  "mt-2 h-12 w-full rounded-2xl border border-(--m-border) bg-(--m-subtle) px-4 text-sm text-(--m-fg) outline-none transition-all duration-200 placeholder:text-(--m-faint) focus:border-brand focus:bg-(--m-glass) focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50";

export const authLockedInputClass =
  "mt-2 h-12 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm text-emerald-800 outline-none placeholder:text-emerald-700/60 dark:text-emerald-50 dark:placeholder:text-emerald-100/40";

export const authOtpInputClass =
  "h-14 w-full rounded-2xl border border-(--m-border) bg-(--m-subtle) px-4 text-center font-mono text-lg tracking-[0.45em] text-(--m-fg) outline-none transition-all duration-200 placeholder:text-(--m-faint) focus:border-brand focus:bg-(--m-glass) focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50";

export const authCompactInputClass =
  "h-11 rounded-xl border border-(--m-border) bg-(--m-subtle) text-sm text-(--m-fg) placeholder:text-(--m-faint) transition-all duration-200 focus:border-brand focus:bg-(--m-glass) focus:ring-2 focus:ring-brand/20";

export const authTextareaClass =
  "rounded-xl border border-(--m-border) bg-(--m-subtle) text-sm text-(--m-fg) placeholder:text-(--m-faint) transition-all duration-200 focus:border-brand focus:bg-(--m-glass) focus:ring-2 focus:ring-brand/20";

export const authPrimaryBtnClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-sm font-semibold text-black shadow-lg shadow-brand/25 transition-all duration-200 hover:bg-sky-300 hover:shadow-brand/40 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export const authSecondaryBtnClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-(--m-border) bg-(--m-subtle) px-4 text-sm font-medium text-(--m-fg) transition-all duration-200 hover:bg-(--m-glass) active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";

export const authSubtleBtnClass =
  "inline-flex items-center gap-2 text-sm font-medium m-muted transition-all duration-200 hover:text-(--m-fg)";

export const authStrategyBtnClass =
  "group flex w-full items-center gap-3 rounded-2xl border border-(--m-border) bg-(--m-subtle) px-4 py-3.5 text-left text-sm text-(--m-fg) transition-all duration-200 hover:bg-(--m-glass)";

export const authFieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.22em] m-faint";

export const authSelectTriggerClass =
  "h-11 w-full rounded-xl border border-(--m-border) bg-(--m-subtle) text-left text-sm text-(--m-fg) transition-all duration-200 focus:border-brand focus:ring-2 focus:ring-brand/20";

export const authSelectContentClass =
  "rounded-xl border border-(--m-border) bg-(--m-glass-strong) text-(--m-fg) shadow-lg";

export const authSelectItemClass =
  "cursor-pointer text-(--m-fg) focus:bg-(--m-subtle) focus:text-(--m-fg)";

export const authCheckboxClass =
  "pointer-events-none mt-0.5 h-4 w-4 rounded border border-(--m-border) bg-(--m-subtle) accent-cyan-600";

export const authErrorClass =
  "rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-100";

export const authPageGlowStyle: CSSProperties = {
  background:
    "radial-gradient(ellipse 70% 42% at 12% 0%, var(--m-glow-violet) 0%, transparent 58%), radial-gradient(ellipse 55% 36% at 88% 12%, var(--m-glow-cyan) 0%, transparent 55%)",
};
