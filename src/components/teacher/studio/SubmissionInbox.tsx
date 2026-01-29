"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AssignmentSubmission } from "@/hooks/teacher/useAssignmentSubmissions";

const statusStyles: Record<string, string> = {
  submitted: "border border-indigo-500/40 bg-indigo-500/15 text-indigo-200",
  late: "border border-amber-500/40 bg-amber-500/15 text-amber-200",
  graded: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  returned: "border border-rose-500/40 bg-rose-500/15 text-rose-200",
};

export type SubmissionInboxProps = {
  submissions: AssignmentSubmission[];
  hrefBase?: string;
};

export function SubmissionInbox({ submissions, hrefBase = "/teacher/studio/submissions" }: SubmissionInboxProps) {
  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
        No submissions yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((submission) => (
        <Link
          key={submission.id}
          href={`${hrefBase}/${submission.id}`}
          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10 md:flex-row md:items-center md:justify-between"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn(statusStyles[submission.status] || "border border-white/10 bg-white/10 text-white/70")}>
                {submission.status.replace(/_/g, " ")}
              </Badge>
              <span className="text-sm font-semibold text-white">
                {submission.student?.name || "Student"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-white/40" />
                {submission.submittedAt
                  ? new Date(submission.submittedAt).toLocaleDateString()
                  : "Not submitted"}
              </span>
              {submission.isLate && (
                <span className="inline-flex items-center gap-2 text-amber-200">
                  <Clock className="h-4 w-4" />
                  Late
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-white/40" />
              {submission.student?.admissionNo || ""}
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              {submission.score !== null ? `${submission.score} pts` : "Ungraded"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
