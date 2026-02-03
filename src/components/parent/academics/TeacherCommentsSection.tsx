// src/components/parent/academics/TeacherCommentsSection.tsx
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

type TeacherComment = {
  id: string;
  commentType: string;
  subjectId: string | null;
  subjectName: string | null;
  teacherName: string | null;
  comment: string;
  isPublic: boolean;
  createdAt: string;
};

type Props = {
  comments: TeacherComment[];
};

const typeLabel: Record<string, string> = {
  subject: "Subject",
  general: "General",
  promotion: "Promotion",
  behavior: "Behaviour",
};

export function TeacherCommentsSection({ comments }: Props) {
  // Only show public comments to parents
  const publicComments = comments.filter((c) => c.isPublic);

  if (!publicComments.length) {
    return (
      <Card className="border-white/10 bg-slate-950/80">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-500/30">
              <MessageSquare className="h-4 w-4 text-purple-300" />
            </div>
            <h3 className="text-sm font-semibold text-slate-50">
              Teacher Comments
            </h3>
          </div>
          <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
            <p className="text-[11px] text-muted-foreground/90">
              No teacher comments for this term yet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-slate-950/80">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-500/30">
              <MessageSquare className="h-4 w-4 text-purple-300" />
            </div>
            <h3 className="text-sm font-semibold text-slate-50">
              Teacher Comments
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {publicComments.length} comment{publicComments.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="space-y-2">
          {publicComments.map((c) => (
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
