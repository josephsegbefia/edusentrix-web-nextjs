// Shared field chrome for the admissions admin workspace.
// Light and dark both read through --ws-* so labels stay legible on tinted fills.

import { cn } from "@/lib/utils";

export const admissionsAdminFieldClass = cn(
  "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) shadow-none",
  "placeholder:text-(--ws-fg-40)",
  "focus-visible:border-violet-500/50 focus-visible:ring-violet-500/30",
  "aria-invalid:border-rose-500/50 aria-invalid:ring-rose-500/20"
);
