"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function DelegateModuleBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm leading-snug text-sky-50/95",
        className
      )}
      role="status"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-200/90" aria-hidden />
      <p>
        You are managing this area as a delegate. Your actions are visible to the school admin.
      </p>
    </div>
  );
}
