"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export default function LimitIndicator({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number | null;
}) {
  const ratio = limit && limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-medium">
          {current}
          {limit !== null ? ` / ${limit}` : " / unlimited"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full",
            ratio >= 90 ? "bg-red-500" : ratio >= 70 ? "bg-amber-400" : "bg-cyan-400"
          )}
          style={{ width: `${limit === null ? 20 : ratio}%` }}
        />
      </div>
    </div>
  );
}
