"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Flame,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const toneStyles: Record<
  string,
  {
    border: string;
    bg: string;
    icon: string;
    glow: string;
    badge: string;
    ring: string;
  }
> = {
  amber: {
    border: "border-amber-500/25",
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
    icon: "text-amber-300",
    glow: "bg-amber-500/20",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    ring: "stroke-amber-400",
  },
  indigo: {
    border: "border-indigo-500/25",
    bg: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    icon: "text-indigo-300",
    glow: "bg-indigo-500/20",
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    ring: "stroke-indigo-400",
  },
  rose: {
    border: "border-rose-500/25",
    bg: "from-rose-500/10 via-rose-500/5 to-transparent",
    icon: "text-rose-300",
    glow: "bg-rose-500/20",
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    ring: "stroke-rose-400",
  },
  emerald: {
    border: "border-emerald-500/25",
    bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    icon: "text-emerald-300",
    glow: "bg-emerald-500/20",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    ring: "stroke-emerald-400",
  },
  slate: {
    border: "border-slate-500/25",
    bg: "from-slate-500/10 via-slate-500/5 to-transparent",
    icon: "text-slate-300",
    glow: "bg-slate-500/20",
    badge: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    ring: "stroke-slate-400",
  },
};

function PriorityIcon({ count, tone }: { count: number; tone: string }) {
  const iconClass = cn("h-4 w-4", toneStyles[tone]?.icon ?? "text-white/40");
  if (count >= 10) return <Flame className={iconClass} />;
  if (count >= 5) return <AlertTriangle className={iconClass} />;
  if (count >= 1) return <Zap className={iconClass} />;
  return <CircleDot className={iconClass} />;
}

function MiniRing({
  count,
  max = 20,
  tone,
}: {
  count: number;
  max?: number;
  tone: string;
}) {
  const pct = Math.min(count / max, 1);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const ringClass = toneStyles[tone]?.ring ?? "stroke-white/20";

  return (
    <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="3"
        className="stroke-white/8"
      />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className={cn("transition-all duration-700", ringClass)}
      />
      <text
        x="20"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white text-[11px] font-bold"
        transform="rotate(90 20 20)"
      >
        {count}
      </text>
    </svg>
  );
}

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
  const totalItems = items.reduce((sum, i) => sum + i.count, 0);
  const urgentCount = items.filter((i) => i.count >= 5).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/10 via-violet-500/5 to-transparent"
        aria-hidden
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-violet-500/20">
            <Zap className="h-4 w-4 text-violet-200" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Smart Queues</h3>
            <p className="text-[11px] text-white/40">Priority tasks at a glance</p>
          </div>
        </div>

        {!loading && items.length > 0 && (
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                <Flame className="h-3 w-3" />
                {urgentCount} urgent
              </span>
            )}
            <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold text-white/60">
              {totalItems} total
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="relative z-10 p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-[72px] w-full animate-pulse rounded-2xl border border-white/8 bg-white/5"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-200">
              All caught up
            </p>
            <p className="mt-1 text-xs text-white/35">
              No pending items need your attention right now.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item, idx) => {
              const tone = item.tone || "slate";
              const styles = toneStyles[tone];

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-linear-to-br p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20",
                    styles.border,
                    styles.bg
                  )}
                >
                  {/* Corner glow */}
                  <div
                    className={cn(
                      "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl transition-opacity duration-300 group-hover:opacity-60",
                      styles.glow
                    )}
                    aria-hidden
                  />

                  {/* Progress ring */}
                  <div className="relative shrink-0">
                    <MiniRing count={item.count} tone={tone} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PriorityIcon count={item.count} tone={tone} />
                      <span className="truncate text-sm font-semibold text-white">
                        {item.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/40">
                      <span>
                        {item.count === 1
                          ? "1 item"
                          : `${item.count} items`}{" "}
                        needs attention
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/50 transition-all duration-200 group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white/70">
                    View
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && items.length > 0 && (
        <div className="relative z-10 border-t border-white/6 px-5 py-3">
          <div className="flex items-center justify-between text-[11px] text-white/30">
            <span>Sorted by priority</span>
            <span>{items.length} queue{items.length !== 1 ? "s" : ""} active</span>
          </div>
        </div>
      )}
    </div>
  );
}
