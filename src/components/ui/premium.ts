// src/components/ui/premium.ts
/**
 * Premium UI component styles for consistent, elegant dark theme design.
 * Use these across dropdown menus, selects, and other popup components.
 */

// ============================================================================
// Menu & Dropdown Content Styles
// ============================================================================

export const premiumMenuContent =
  "bg-neutral-950/95 backdrop-blur-xl border border-white/10 " +
  "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] " +
  "rounded-xl p-1.5";

export const premiumMenuItem =
  "rounded-lg px-3 py-2.5 text-sm font-medium " +
  "text-white/70 hover:text-white " +
  "hover:bg-white/10 " +
  "focus:bg-white/10 focus:text-white focus:outline-none " +
  "cursor-pointer transition-all duration-150 " +
  "flex items-center gap-2.5";

export const premiumMenuItemDestructive =
  "rounded-lg px-3 py-2.5 text-sm font-medium " +
  "text-rose-400 hover:text-rose-300 " +
  "hover:bg-rose-500/10 " +
  "focus:bg-rose-500/10 focus:text-rose-300 focus:outline-none " +
  "cursor-pointer transition-all duration-150 " +
  "flex items-center gap-2.5";

export const premiumMenuItemSuccess =
  "rounded-lg px-3 py-2.5 text-sm font-medium " +
  "text-emerald-400 hover:text-emerald-300 " +
  "hover:bg-emerald-500/10 " +
  "focus:bg-emerald-500/10 focus:text-emerald-300 focus:outline-none " +
  "cursor-pointer transition-all duration-150 " +
  "flex items-center gap-2.5";

export const premiumMenuItemWarning =
  "rounded-lg px-3 py-2.5 text-sm font-medium " +
  "text-amber-400 hover:text-amber-300 " +
  "hover:bg-amber-500/10 " +
  "focus:bg-amber-500/10 focus:text-amber-300 focus:outline-none " +
  "cursor-pointer transition-all duration-150 " +
  "flex items-center gap-2.5";

export const premiumSeparator = "bg-white/10 my-1.5";

// ============================================================================
// Select Component Styles
// ============================================================================

export const premiumSelectTrigger =
  "flex h-10 w-full items-center justify-between gap-2 " +
  "rounded-xl border border-white/10 bg-white/5 " +
  "px-3.5 py-2 text-sm text-white " +
  "ring-offset-background placeholder:text-white/40 " +
  "hover:bg-white/8 hover:border-white/20 " +
  "focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "transition-all duration-150";

export const premiumSelectContent =
  "bg-neutral-950/95 backdrop-blur-xl border border-white/10 " +
  "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] " +
  "rounded-xl p-1.5 overflow-hidden";

export const premiumSelectItem =
  "relative flex w-full cursor-pointer select-none items-center " +
  "rounded-lg py-2.5 pl-3 pr-8 text-sm font-medium outline-none " +
  "text-white/70 " +
  "hover:bg-white/10 hover:text-white " +
  "focus:bg-white/10 focus:text-white " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
  "transition-all duration-150";

export const premiumSelectItemIndicator =
  "absolute right-2.5 flex h-4 w-4 items-center justify-center text-violet-400";

export const premiumSelectLabel =
  "px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/40";

export const premiumSelectScrollButton =
  "flex cursor-default items-center justify-center py-1.5 text-white/50";

// ============================================================================
// Navigation Styles
// ============================================================================

export const premiumSideItem =
  "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium " +
  "text-white/60 hover:text-white " +
  "hover:bg-white/8 " +
  "transition-all duration-150";

export const premiumSideItemActive =
  "bg-white/10 text-white ring-1 ring-white/10";

export const premiumTopLink =
  "rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:text-white " +
  "hover:bg-white/8 transition-all duration-150";

// ============================================================================
// Badge Styles for Menu Items
// ============================================================================

export const premiumMenuBadge =
  "ml-auto inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold " +
  "bg-violet-500/20 text-violet-300 ring-1 ring-inset ring-violet-500/30";

export const premiumMenuBadgeNew =
  "ml-auto inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold " +
  "bg-emerald-500/20 text-emerald-300 ring-1 ring-inset ring-emerald-500/30";
