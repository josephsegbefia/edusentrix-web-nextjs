"use client";

import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Smaller text for dense tables */
  size?: "sm" | "md";
};

export function PendingInviteBadge({ className, size = "md" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-amber-500/35 bg-amber-500/15 font-medium text-amber-200",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]",
        className
      )}
      title="Has not accepted the invitation — no platform login yet"
    >
      <Send className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
      Invite pending
    </span>
  );
}
