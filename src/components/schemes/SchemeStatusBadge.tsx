"use client";

import { Badge } from "@/components/ui/badge";
import type { SchemeStatus } from "@/types/schemes";
import { cn } from "@/lib/utils";

const LABELS: Record<SchemeStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  needs_revision: "Needs Revision",
  approved: "Approved",
  active: "Active",
  archived: "Archived",
  rejected: "Rejected",
};

export function SchemeStatusBadge({
  status,
  className,
}: {
  status: SchemeStatus;
  className?: string;
}) {
  const tone =
    status === "active"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
      : status === "approved"
        ? "border-blue-400/30 bg-blue-500/15 text-blue-100"
        : status === "submitted"
          ? "border-amber-400/30 bg-amber-500/15 text-amber-100"
          : status === "needs_revision"
            ? "border-orange-400/30 bg-orange-500/15 text-orange-100"
            : status === "rejected"
              ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
              : "border-white/15 bg-white/8 text-white/70";

  return (
    <Badge variant="outline" className={cn("font-medium", tone, className)}>
      {LABELS[status]}
    </Badge>
  );
}
