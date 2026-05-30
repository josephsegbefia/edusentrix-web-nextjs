"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentAcademicsDataSource } from "@/types/admin/student-academics";

type Props = {
  dataSource?: StudentAcademicsDataSource;
  dataSourceNotes?: string[];
  className?: string;
};

export function AcademicsDataSourceNotice({
  dataSource,
  dataSourceNotes,
  className,
}: Props) {
  if (!dataSource || dataSource === "assessment_engine") {
    return null;
  }

  const title =
    dataSource === "mixed"
      ? "Mixed academic data sources"
      : "Legacy gradebook data";

  const fallbackMessage =
    dataSource === "mixed"
      ? "Some subjects or term summaries still use the older gradebook until all results are migrated to the assessment engine."
      : "This view is showing older SubjectGrade and TermResult records. New assessment engine results will replace them when available.";

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
