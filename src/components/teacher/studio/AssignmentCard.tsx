"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  basePath?: string;
  itemLabel?: string;
  onPublish?: (id: string) => void;
  onClose?: (id: string) => void;
  onArchive?: (id: string) => void;
};

export function AssignmentCard({
  assignment,
  basePath = "/teacher/studio/assignments",
  itemLabel = "Assignment",
  onPublish,
  onClose,
  onArchive,
}: AssignmentCardProps) {
  const router = useRouter();
  const classes = assignment.classGroups.map((group) => group.name);
  const classPreview = classes.slice(0, 3).join(", ");
  const extraCount = classes.length - 3;
  const detailsHref = `${basePath}/${assignment.id}`;
  const editHref = `${basePath}/${assignment.id}?edit=1`;
  const submissionsHref = `${basePath}/${assignment.id}/submissions`;

  const openDetails = React.useCallback(() => {
    router.push(detailsHref);
  }, [detailsHref, router]);

  const handleCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openDetails();
    },
    [openDetails]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={handleCardKeyDown}
      aria-label={`View details for ${itemLabel.toLowerCase()} ${assignment.title}`}
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-900/55 to-slate-950/40 p-5 shadow-xl shadow-black/30 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-2xl hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-indigo-500/10 via-transparent to-emerald-500/10 opacity-70 transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
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
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/65">
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
          <p className="text-xs text-white/45">
            Click card to open {itemLabel.toLowerCase()} details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[380px]">
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-4 py-3 shadow-inner shadow-indigo-500/10">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs text-indigo-100/90">
                  <ClipboardCheck className="h-4 w-4 text-indigo-300" />
                  Pending
                </span>
                <span className="text-base font-semibold text-white">
                  {assignment.stats.pending}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 shadow-inner shadow-emerald-500/10">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs text-emerald-100/90">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  Graded
                </span>
                <span className="text-base font-semibold text-white">
                  {assignment.stats.graded}
                </span>
              </div>
            </div>
          </div>

          <Link
            href={detailsHref}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/20"
          >
            <Eye className="h-4 w-4" />
            View details
          </Link>

          <PremiumDropdownMenu>
            <PremiumDropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                className="h-9 w-9 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PremiumDropdownMenuTrigger>
            <PremiumDropdownMenuContent align="end">
              <PremiumDropdownMenuItem asChild>
                <Link href={detailsHref} className="flex items-center gap-2.5">
                  <Eye className="h-4 w-4" />
                  View Details
                </Link>
              </PremiumDropdownMenuItem>
              <PremiumDropdownMenuItem asChild>
                <Link href={editHref} className="flex items-center gap-2.5">
                  <Pencil className="h-4 w-4" />
                  Edit {itemLabel}
                </Link>
              </PremiumDropdownMenuItem>
              <PremiumDropdownMenuItem asChild>
                <Link href={submissionsHref} className="flex items-center gap-2.5">
                  <Users className="h-4 w-4" />
                  View Submissions
                </Link>
              </PremiumDropdownMenuItem>
              <PremiumDropdownMenuSeparator />
              {assignment.status === "draft" && onPublish && (
                <PremiumDropdownMenuItem onClick={() => onPublish(assignment.id)} variant="success">
                  Publish {itemLabel}
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
