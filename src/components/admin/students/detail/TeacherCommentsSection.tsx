"use client";

import * as React from "react";
import type { TeacherCommentDTO } from "@/types/admin/student-academics";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  comments: TeacherCommentDTO[];
};

const typeLabel: Record<string, string> = {
  subject: "Subject",
  general: "General",
  promotion: "Promotion",
  behavior: "Behaviour",
};

export function TeacherCommentsSection({ comments }: Props) {
  if (!comments.length) return null;

  return (
    <Card className="border-white/10 bg-slate-950/80">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-50">
            Teacher Comments
          </h3>
          <span className="text-[11px] text-slate-400">
            {comments.length} entr{comments.length === 1 ? "y" : "ies"}
          </span>
        </div>
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-100"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      c.commentType === "subject"
                        ? "bg-sky-500/20 text-sky-50 border border-sky-400/40"
                        : c.commentType === "behavior"
                        ? "bg-amber-500/20 text-amber-50 border border-amber-400/40"
                        : "bg-slate-700/70 text-slate-100 border border-slate-500/60"
                    )}
                  >
                    {typeLabel[c.commentType] ?? c.commentType}
                  </span>
                  {c.subjectName && (
                    <span className="text-[11px] text-slate-300">
                      {c.subjectName}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">
                  {c.teacherName ?? "Teacher"} •{" "}
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-100/90">
                {c.comment}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
