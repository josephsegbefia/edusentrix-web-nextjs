"use client";

import { ClassTimetableEditor } from "./ClassTimetableEditor";

type ClassScheduleTabProps = {
  classId: string;
  className: string;
};

/**
 * Class Schedule tab: primary creation path for class-group timetable.
 * Build the timetable per class (day + period + subject + teacher).
 * This is the source of truth for the master timetable.
 */
export function ClassScheduleTab({ classId, className }: ClassScheduleTabProps) {
  return <ClassTimetableEditor classId={classId} className={className} />;
}
