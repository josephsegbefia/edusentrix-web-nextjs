"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { ClassTimetableEditor } from "@/components/admin/classes/detail/ClassTimetableEditor";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";

export default function TeacherHomeroomTimetablePage() {
  const ctx = useTeacherContext();
  const classesQ = useTeacherClasses();

  const homeroomId = ctx.data?.data?.teacher.homeroomClassGroupId;
  const homeroomClass = React.useMemo(() => {
    const list = classesQ.data?.data?.classes ?? [];
    if (!homeroomId) return undefined;
    return list.find((c) => c._id === homeroomId);
  }, [classesQ.data, homeroomId]);

  if (ctx.isLoading || classesQ.isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-white/70">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        <p className="text-sm">Loading homeroom…</p>
      </div>
    );
  }

  if (!homeroomId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-white/80">
        <p className="text-lg font-medium text-white">No homeroom class</p>
        <p className="mt-2 text-sm text-white/60">
          When your school assigns you as a homeroom teacher, you can build and adjust that
          class timetable here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Homeroom timetable</h1>
        <p className="text-sm text-white/60">
          {homeroomClass?.name || "Your class"} — same tools as school admins: period grid, drag and
          drop, and whole-school clash checks on the draft.
        </p>
      </div>

      <ClassTimetableEditor
        classId={homeroomId}
        className={homeroomClass?.name || "Homeroom"}
        gradeId={homeroomClass?.gradeId || null}
        schoolTimetablePlannerHref="/teacher/calendar"
        bellScheduleSettingsHref="/teacher/settings"
        canPublishTimetable={false}
      />
    </div>
  );
}
