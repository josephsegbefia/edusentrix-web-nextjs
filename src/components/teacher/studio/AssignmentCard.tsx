"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardCheck, Eye, MoreHorizontal, Pencil, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import type { StudioAssignment } from "@/hooks/teacher/useTeacherAssignments";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  draft: "border border-white/10 bg-white/10 text-white/70",
  published: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  closed: "border border-amber-500/40 bg-amber-500/15 text-amber-200",
  archived: "border border-rose-500/40 bg-rose-500/15 text-rose-200",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
  archived: "Archived",
};

export type AssignmentCardProps = {
  assignment: StudioAssignment;
  onPublish?: (id: string) => void;
  onClose?: (id: string) => void;
  onArchive?: (id: string) => void;
};

export function AssignmentCard({
  assignment,
  onPublish,
  onClose,
  onArchive,
}: AssignmentCardProps) {
  const classes = assignment.classGroups.map((group) => group.name);
  const classPreview = classes.slice(0, 3).join(", ");
  const extraCount = classes.length - 3;

  return (
    <div className="rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-4 shadow-lg shadow-black/20 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn(statusStyles[assignment.status] || statusStyles.draft)}>
              {statusLabel[assignment.status] || "Draft"}
            </Badge>
            <span className="text-xs uppercase tracking-[0.2em] text-white/40">
              {assignment.subject?.name || "Subject"}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white">{assignment.title}</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-white/40" />
              {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "No due date"}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-white/40" />
              {classPreview || "No classes"}
              {extraCount > 0 ? ` +${extraCount}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-indigo-300" />
              <span>{assignment.stats.pending} pending</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <span>{assignment.stats.graded} graded</span>
            </div>
          </div>

          <Link
            href={`/teacher/studio/assignments/${assignment.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/20"
          >
            <Eye className="h-4 w-4" />
            Details
          </Link>

          <PremiumDropdownMenu>
            <PremiumDropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PremiumDropdownMenuTrigger>
            <PremiumDropdownMenuContent align="end">
              <PremiumDropdownMenuItem asChild>
                <Link href={`/teacher/studio/assignments/${assignment.id}`} className="flex items-center gap-2.5">
                  <Eye className="h-4 w-4" />
                  View Details
                </Link>
              </PremiumDropdownMenuItem>
              <PremiumDropdownMenuItem asChild>
                <Link href={`/teacher/studio/assignments/${assignment.id}?edit=1`} className="flex items-center gap-2.5">
                  <Pencil className="h-4 w-4" />
                  Edit Assignment
                </Link>
              </PremiumDropdownMenuItem>
              <PremiumDropdownMenuItem asChild>
                <Link href={`/teacher/studio/assignments/${assignment.id}/submissions`} className="flex items-center gap-2.5">
                  <Users className="h-4 w-4" />
                  View Submissions
                </Link>
              </PremiumDropdownMenuItem>
              <PremiumDropdownMenuSeparator />
              {assignment.status === "draft" && onPublish && (
                <PremiumDropdownMenuItem onClick={() => onPublish(assignment.id)} variant="success">
                  Publish Assignment
                </PremiumDropdownMenuItem>
              )}
              {assignment.status === "published" && onClose && (
                <PremiumDropdownMenuItem onClick={() => onClose(assignment.id)} variant="warning">
                  Close Submissions
                </PremiumDropdownMenuItem>
              )}
              {onArchive && (
                <>
                  <PremiumDropdownMenuSeparator />
                  <PremiumDropdownMenuItem onClick={() => onArchive(assignment.id)} variant="destructive">
                    Archive Assignment
                  </PremiumDropdownMenuItem>
                </>
              )}
            </PremiumDropdownMenuContent>
          </PremiumDropdownMenu>
        </div>
      </div>
    </div>
  );
}
