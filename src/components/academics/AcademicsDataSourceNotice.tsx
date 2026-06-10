"use client";

import { Info } from "lucide-react";
import { resolveAcademicsDataSourceNotice } from "@/lib/academics/compatibility/academic-profile-to-legacy-dto";
import { cn } from "@/lib/utils";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import type { StudentAcademicsDataSource } from "@/types/admin/student-academics";

type Props = {
  dataSource?:
    | StudentAcademicProfileDTO["dataSource"]
    | StudentAcademicsDataSource
    | null;
  dataSourceNotes?: string[];
  className?: string;
};

export function AcademicsDataSourceNotice({
  dataSource,
  dataSourceNotes,
  className,
}: Props) {
  const noticeSource = resolveAcademicsDataSourceNotice(dataSource);
  if (!noticeSource) {
    return null;
  }

  const title =
    noticeSource === "mixed"
      ? "Mixed academic data sources"
      : "Previous gradebook results";

  const fallbackMessage =
    noticeSource === "mixed"
      ? "Some subjects or term summaries still use the previous gradebook until all results are available in the current assessment system."
      : "These results come from the previous gradebook for this period. They will update when scores are entered and released in the current assessment system.";

  const notes = dataSourceNotes?.length ? dataSourceNotes : [fallbackMessage];

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3",
        className
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-300" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-100">{title}</p>
          {notes.map((note) => (
            <p key={note} className="text-sm text-amber-100/80">
              {note}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
