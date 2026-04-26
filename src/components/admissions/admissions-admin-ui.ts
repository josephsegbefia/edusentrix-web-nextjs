// src/components/admissions/admissions-admin-ui.ts
// Shared field chrome for the admissions admin workspace (slate-950 + glass
// cards). The default shadcn `Input` / `Textarea` use the theme token
// `border-input`, which on this surface reads as a bright “white” outline.
// These classes match `premiumSelectTrigger` in `src/components/ui/premium.ts`.

import { cn } from "@/lib/utils";

export const admissionsAdminFieldClass = cn(
  "border-white/10 bg-white/5 text-white shadow-none",
  "placeholder:text-white/40",
  "focus-visible:border-violet-500/50 focus-visible:ring-violet-500/30",
  "aria-invalid:border-rose-500/50 aria-invalid:ring-rose-500/20"
);
