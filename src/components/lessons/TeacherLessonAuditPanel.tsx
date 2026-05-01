"use client";

import * as React from "react";
import { format } from "date-fns/format";
import { ChevronDown, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTeacherLessonAudit } from "@/hooks/teacher/useTeacherLessonAudit";
import { cn } from "@/lib/utils";

type Props = {
  lessonId: string;
  canView: boolean;
};

export function TeacherLessonAuditPanel({ lessonId, canView }: Props) {
  const [open, setOpen] = React.useState(false);
  const { data, isLoading, error } = useTeacherLessonAudit(lessonId, canView && open);

  if (!canView) return null;

  return (
    <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-200">
            <History className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg text-white">Activity log</CardTitle>
            <p className="text-xs text-white/45">Recent publish & resource events for this lesson.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="border-white/15 bg-white/5 text-white hover:bg-white/10"
        >
          <ChevronDown className={cn("mr-1 h-4 w-4 transition-transform", open && "rotate-180")} />
          {open ? "Hide" : "Show"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          {error && (
            <p className="text-sm text-rose-200/90">{error instanceof Error ? error.message : "Failed to load"}</p>
          )}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          )}
          {!isLoading && data && data.length === 0 && (
            <p className="py-4 text-sm text-white/50">No audit entries yet.</p>
          )}
          {!isLoading && data && data.length > 0 && (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
              {data.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-white/80"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/45">
                      {row.createdAt
                        ? format(new Date(row.createdAt), "MMM d, HH:mm")
                        : "—"}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-white/20 font-mono text-[10px] uppercase text-white/75"
                    >
                      {row.action.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-white/55">
                    {row.actorLabel ? (
                      <>
                        <span className="text-white/70">{row.actorLabel}</span>
                        <span className="text-white/35"> · </span>
                      </>
                    ) : null}
                    <span className="font-mono text-[10px] text-white/40">{row.actorId}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}
