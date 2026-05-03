"use client";

import * as React from "react";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { cn } from "@/lib/utils";

/** Static Leo-style guidance (no API call) for internal test platform screens. */
export function InternalTestLeoHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4",
        className
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15">
        <LeoIcon className="h-5 w-5 text-violet-200" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-white/85">{children}</div>
    </div>
  );
}
