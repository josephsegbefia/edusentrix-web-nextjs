/** Signed-in chrome. Follows the html theme. Page columns stay inside `.dark`. */

export const shellSidebarFrameClass =
  "border-(--m-border) bg-(--m-glass-strong) text-(--m-fg) backdrop-blur-2xl";

export const shellSidebarSheetClass =
  "border-(--m-border)! bg-(--m-glass-strong)! text-(--m-fg)!";

export const shellSidebarItemClass =
  "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium m-muted transition-all duration-200 ease-out hover:bg-(--m-subtle) hover:text-(--m-fg)";

export const shellSidebarItemActiveClass =
  "bg-(--m-subtle) text-(--m-fg) shadow-[inset_0_0_0_1px_var(--m-border)]";

export const shellTopLinkClass =
  "rounded-lg px-3 py-2 text-sm font-medium m-muted transition-all duration-150 hover:bg-(--m-subtle) hover:text-(--m-fg)";
