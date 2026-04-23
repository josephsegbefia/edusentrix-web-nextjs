"use client";

import * as React from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ClassTimetableEditor } from "@/components/admin/classes/detail/ClassTimetableEditor";
import { PublishedTimetableCalendar } from "@/components/admin/classes/detail/PublishedTimetableCalendar";
import { Button } from "@/components/ui/button";
import { ComingSoonPanel } from "@/components/ui/coming-soon-panel";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import {
  useClassPublishedTimetable,
  useDeleteClassPublishedTimetable,
} from "@/hooks/admin/useClassPublishedTimetable";
import { isTimetableRebootEnabled } from "@/lib/timetable/feature-flags";

type ClassScheduleTabProps = {
  classId: string;
  className: string;
  gradeId?: string | null;
};

/**
 * Class group schedule: published week grid when a published timetable exists; otherwise the
 * timetable creation/editor flow. Admins and homeroom teachers can edit or clear the published
 * class view.
 */
export function ClassScheduleTab({ className, classId, gradeId }: ClassScheduleTabProps) {
  const [periodId, setPeriodId] = React.useState<string>("");
  const [view, setView] = React.useState<"published" | "edit">("published");

  const periodsQuery = useAcademicPeriods();
  const periods = periodsQuery.data?.periods || [];

  React.useEffect(() => {
    if (periodId || !periods.length) return;
    const current = periods.find((p) => p.isCurrent) || periods[0];
    if (current?._id) setPeriodId(current._id);
  }, [periods, periodId]);

  const publishedQuery = useClassPublishedTimetable(classId, periodId);
  const deletePublished = useDeleteClassPublishedTimetable(classId);

  const meta = publishedQuery.data?.meta;
  const hasPublishedForPeriod = Boolean(
    meta?.hasPublishedVersion &&
      ((meta.slotCount ?? 0) + (meta.gapFillCount ?? 0) > 0)
  );
  const showReadOnly = view === "published" && hasPublishedForPeriod;
  const canManage = Boolean(meta?.canManage);

  if (!isTimetableRebootEnabled()) {
    return (
      <ComingSoonPanel
        title="Class timetable"
        description={`Timetable building for ${className} is temporarily disabled. The timetable is off by default (sunset). Add NEXT_PUBLIC_FEATURE_TIMETABLE_SUNSET=false to .env.local and restart the dev server so this page can show the editor (server-only FEATURE_TIMETABLE_SUNSET is not visible in the browser).`}
      />
    );
  }

  if (periodsQuery.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!periodId) {
    return (
      <p className="text-sm text-muted-foreground">
        Add an academic period under school admin settings to work with this class schedule.
      </p>
    );
  }

  if (view === "published" && publishedQuery.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (view === "published" && publishedQuery.isError) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          {publishedQuery.error instanceof Error
            ? publishedQuery.error.message
            : "Could not load the published timetable."}
        </p>
        <Button type="button" variant="secondary" onClick={() => setView("edit")}>
          Open timetable editor
        </Button>
      </div>
    );
  }

  const onDeletePublished = async () => {
    if (!canManage) return;
    if (
      !window.confirm(
        "Remove this class’s lessons from the published school timetable? Other classes are not affected. You can rebuild from the editor afterwards."
      )
    ) {
      return;
    }
    try {
      await deletePublished.mutateAsync(periodId);
      toast.success("This class was removed from the published timetable.");
      setView("edit");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear timetable");
    }
  };

  if (showReadOnly && publishedQuery.data) {
    const p = publishedQuery.data;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PremiumSelect value={periodId} onValueChange={setPeriodId}>
            <PremiumSelectTrigger className="w-[220px]">
              <PremiumSelectValue placeholder="Academic period" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {periods.map((pItem) => (
                <PremiumSelectItem key={pItem._id} value={pItem._id}>
                  {pItem.yearLabel} {pItem.term}
                  {pItem.isCurrent ? " (Current)" : ""}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setView("edit")}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={onDeletePublished}
                disabled={deletePublished.isPending}
              >
                {deletePublished.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
        <PublishedTimetableCalendar
          classLabel={className}
          workingDays={p.meta.workingDays?.length ? p.meta.workingDays : [1, 2, 3, 4, 5]}
          timeAxis={p.meta.timeAxis}
          slots={p.data}
          gapFills={p.gapFills ?? []}
          dayScheduleSegments={p.dayScheduleSegments ?? []}
          calendarKey={periodId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasPublishedForPeriod && view === "edit" && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setView("published")}>
            View published
          </Button>
        </div>
      )}
      <ClassTimetableEditor
        classId={classId}
        className={className}
        gradeId={gradeId}
        bellScheduleSettingsHref="/admin/settings?tab=dailySchedule"
        academicPeriodId={periodId}
        onAcademicPeriodIdChange={setPeriodId}
      />
    </div>
  );
}
