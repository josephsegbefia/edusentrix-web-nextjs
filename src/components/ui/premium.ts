// src/components/ui/premium.ts
/**
 * Premium UI component styles.
 * Menu and select colors follow `--ws-*` (dark by default, light inside `.workspace`).
 * In-flow nav classes follow the shell theme.
 */
import {
  shellSidebarItemActiveClass,
  shellSidebarItemClass,
  shellTopLinkClass,
} from "@/lib/ui/shell-surfaces";

// ============================================================================
// Menu & Dropdown Content Styles
// ============================================================================

export const premiumMenuContent =
  "bg-(--ws-popover) text-(--ws-fg) backdrop-blur-xl border border-(--ws-line) " +
  "shadow-[var(--ws-popover-shadow)] " +
  "rounded-xl p-1.5";

export const premiumMenuItem =
  "rounded-lg px-3 py-2.5 text-sm font-medium " +
  "text-(--ws-fg-70) hover:text-(--ws-fg) " +
  "hover:bg-(--ws-fill-strong) " +
  "focus:bg-(--ws-fill-strong) focus:text-(--ws-fg) focus:outline-none " +
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

export const premiumSeparator = "bg-(--ws-line) my-1.5";

// ============================================================================
// Select Component Styles
// ============================================================================

export const premiumSelectTrigger =
  "flex h-10 w-full items-center justify-between gap-2 " +
  "rounded-xl border border-(--ws-line) bg-(--ws-fill) " +
  "px-3.5 py-2 text-sm text-(--ws-fg) " +
  "ring-offset-background placeholder:text-(--ws-fg-40) " +
  "hover:bg-(--ws-fill-strong) hover:border-(--ws-line-strong) " +
  "focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "transition-all duration-150";

export const premiumSelectContent =
  "bg-(--ws-popover) text-(--ws-fg) backdrop-blur-xl border border-(--ws-line) " +
  "shadow-[var(--ws-popover-shadow)] " +
  "rounded-xl p-1.5 overflow-hidden";

export const premiumSelectItem =
  "relative flex w-full cursor-pointer select-none items-center " +
  "rounded-lg py-2.5 pl-3 pr-8 text-sm font-medium outline-none " +
  "text-(--ws-fg-70) " +
  "hover:bg-(--ws-fill-strong) hover:text-(--ws-fg) " +
  "focus:bg-(--ws-fill-strong) focus:text-(--ws-fg) " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
  "transition-all duration-150";

export const premiumSelectItemIndicator =
  "absolute right-2.5 flex h-4 w-4 items-center justify-center text-violet-400";

export const premiumSelectLabel =
  "px-3 py-2 text-xs font-semibold uppercase tracking-wider text-(--ws-fg-40)";

export const premiumSelectScrollButton =
  "flex cursor-default items-center justify-center py-1.5 text-(--ws-fg-50)";

// ============================================================================
// Navigation Styles
// ============================================================================

export const premiumSideItem = shellSidebarItemClass;

export const premiumSideItemActive = shellSidebarItemActiveClass;

export const premiumTopLink = shellTopLinkClass;

// ============================================================================
// Badge Styles for Menu Items
// ============================================================================

export const premiumMenuBadge =
  "ml-auto inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold " +
  "bg-violet-500/20 text-violet-300 ring-1 ring-inset ring-violet-500/30";

export const premiumMenuBadgeNew =
  "ml-auto inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold " +
  "bg-emerald-500/20 text-emerald-300 ring-1 ring-inset ring-emerald-500/30";
