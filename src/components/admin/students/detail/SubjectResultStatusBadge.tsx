"use client";

import {
  resolveSubjectResultStatusBadge,
  type SubjectResultStatusBadgeVariant,
} from "@/lib/academics/profile/subject-results-table-utils";
import type { AcademicProfileSubjectResultDTO } from "@/types/academics/student-academic-profile";
import { cn } from "@/lib/utils";

const VARIANT_STYLES: Record<SubjectResultStatusBadgeVariant, string> = {
  official: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  provisional: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  legacy: "border-white/15 bg-white/8 text-white/65",
  submitted: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  returned: "border-rose-400/30 bg-rose-500/10 text-rose-100",
};

type Props = {
  row: AcademicProfileSubjectResultDTO;
  periodIsReleased?: boolean;
  className?: string;
};

export function SubjectResultStatusBadge({
  row,
  periodIsReleased,
  className,
}: Props) {
  const { label, variant } = resolveSubjectResultStatusBadge({
    row,
    periodIsReleased,
  });

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
