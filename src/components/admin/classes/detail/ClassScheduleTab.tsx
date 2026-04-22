"use client";

import { ComingSoonPanel } from "@/components/ui/coming-soon-panel";

type ClassScheduleTabProps = {
  classId: string;
  className: string;
  gradeId?: string | null;
};

/**
 * Class schedule / timetable (coming soon).
 */
export function ClassScheduleTab({ className, classId: _classId, gradeId: _gradeId }: ClassScheduleTabProps) {
  return (
    <ComingSoonPanel
      title="Class timetable"
      description={`Timetable building for ${className} is not available yet. Subject and teacher assignments on the class still work as usual.`}
    />
  );
}
