"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneStyles: Record<
  string,
  { border: string; bg: string; icon: string; glow: string }
> = {
  amber: {
    border: "border-amber-500/30",
    bg: "from-amber-500/15 via-amber-500/5 to-transparent",
    icon: "text-amber-300",
    glow: "bg-amber-500/20",
  },
  indigo: {
    border: "border-indigo-500/30",
    bg: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    icon: "text-indigo-300",
    glow: "bg-indigo-500/20",
  },
  rose: {
    border: "border-rose-500/30",
    bg: "from-rose-500/15 via-rose-500/5 to-transparent",
    icon: "text-rose-300",
    glow: "bg-rose-500/20",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    icon: "text-emerald-300",
    glow: "bg-emerald-500/20",
  },
  slate: {
    border: "border-slate-500/30",
    bg: "from-slate-500/15 via-slate-500/5 to-transparent",
    icon: "text-slate-300",
    glow: "bg-slate-500/20",
  },
};

type QueueItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone?: keyof typeof toneStyles;
};

type SmartQueueProps = {
  items?: QueueItem[];
  loading?: boolean;
};

export function SmartQueue({ items = [], loading }: SmartQueueProps) {
  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20 text-violet-200">
            <AlertTriangle className="h-4 w-4" />
          </span>
          Smart Queues
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-14 w-full animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-white/30" />
            <p>You're all caught up.</p>
          </div>
        ) : (
          items.map((item) => {
            const tone = toneStyles[item.tone || "slate"];
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group relative flex items-center justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10",
                  tone.border,
                  tone.bg
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100",
                    tone.glow,
                    "opacity-40"
                  )}
                  aria-hidden="true"
                />
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="text-xs text-white/50">Needs attention</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold",
                      tone.icon
                    )}
                  >
                    {item.count}
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/40" />
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
