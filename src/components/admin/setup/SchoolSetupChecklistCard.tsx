"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SetupReadinessItem } from "@/types/admin/setup-readiness";
import { useSetupReadinessCoach } from "@/hooks/admin/useSchoolSetupReadiness";

type Props = {
  items: SetupReadinessItem[];
  completionPercent: number;
  incompleteCount: number;
  coachMessage: string;
  loading?: boolean;
};

function priorityLabel(p: SetupReadinessItem["priority"]) {
  switch (p) {
    case "blocking":
      return "Essential";
    case "high":
      return "Important";
    default:
      return "Recommended";
  }
}

export function SchoolSetupChecklistCard({
  items,
  completionPercent,
  incompleteCount,
  coachMessage,
  loading,
}: Props) {
  const [expanded, setExpanded] = React.useState(true);
  const [leoOpen, setLeoOpen] = React.useState(true);
  const [leoDetail, setLeoDetail] = React.useState<{
    text: string;
    fallback: boolean;
  } | null>(null);
  const coachMutation = useSetupReadinessCoach();

  React.useEffect(() => {
    setLeoDetail(null);
  }, [coachMessage]);

  const displayedCoach = leoDetail?.text ?? coachMessage;

  if (loading) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white/50" />
            School setup checklist
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (incompleteCount === 0) {
    return (
      <Card className="relative overflow-hidden border border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="pt-6 pb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white">Setup checklist complete</h3>
            <p className="text-xs text-white/60 mt-1">
              Core configuration looks good. You can still adjust fees, schedule, and payments
              anytime under School settings and Fees.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...items].sort((a, b) => {
    const rank = { blocking: 0, high: 1, medium: 2 };
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.title.localeCompare(b.title);
  });

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-violet-500/8 via-white/5 to-transparent">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/10 via-transparent to-cyan-500/5"
        aria-hidden
      />
      <CardHeader className="relative z-10 pb-2 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold text-white/90 uppercase tracking-wider">
              School setup checklist
            </CardTitle>
            <p className="text-xs text-white/55 mt-1">
              Launch onboarding is done — finish these so finance, attendance, and timetables work
              the way parents and staff expect.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-white/60">
            <span>{completionPercent}% complete</span>
            <span>
              {incompleteCount} remaining
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-violet-400/90 to-brand/90 transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </CardHeader>

      {expanded ? (
        <CardContent className="relative z-10 space-y-4 pt-0">
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setLeoOpen((o) => !o)}
              aria-expanded={leoOpen}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/15">
                <LeoIcon className="h-4 w-4 text-violet-200" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-200/95">
                Leo
              </span>
              <span className="text-xs text-white/45 ml-auto">
                {leoOpen ? "Hide" : "Show"} suggestion
              </span>
            </button>
            {leoOpen ? (
              <div className="mt-3 space-y-3 pl-11">
                <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                  {displayedCoach}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-violet-400/35 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20 hover:text-white"
                    disabled={coachMutation.isPending}
                    onClick={() =>
                      coachMutation.mutate(undefined, {
                        onSuccess: (data) =>
                          setLeoDetail({
                            text: data.coachMessage,
                            fallback: data.fallback,
                          }),
                      })
                    }
                  >
                    {coachMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Asking Leo…
                      </>
                    ) : leoDetail ? (
                      "Refresh Leo tip"
                    ) : (
                      "Expand with Leo"
                    )}
                  </Button>
                  {leoDetail?.fallback ? (
                    <span className="text-[11px] text-white/45">
                      Using quick tip (add OpenAI key for richer coaching).
                    </span>
                  ) : null}
                </div>
                {coachMutation.isError ? (
                  <p className="text-xs text-rose-300/90">
                    {coachMutation.error instanceof Error
                      ? coachMutation.error.message
                      : "Leo could not respond."}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <ul className="space-y-2">
            {sorted.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3",
                  item.done
                    ? "border-white/8 bg-white/3 opacity-75"
                    : item.priority === "blocking"
                      ? "border-amber-500/25 bg-amber-500/8"
                      : "border-white/10 bg-white/5"
                )}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-white/35 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          item.done ? "text-white/55 line-through" : "text-white/90"
                        )}
                      >
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border",
                          item.priority === "blocking"
                            ? "border-amber-400/35 text-amber-200/90"
                            : item.priority === "high"
                              ? "border-white/15 text-white/55"
                              : "border-white/10 text-white/45"
                        )}
                      >
                        {priorityLabel(item.priority)}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{item.description}</p>
                  </div>
                </div>
                {!item.done ? (
                  <Button
                    asChild
                    size="sm"
                    className="shrink-0 bg-brand text-black hover:opacity-90 sm:ml-auto"
                  >
                    <Link href={item.href}>{item.ctaLabel}</Link>
                  </Button>
                ) : (
                  <span className="text-[11px] text-emerald-400/90 shrink-0 sm:ml-auto">Done</span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
