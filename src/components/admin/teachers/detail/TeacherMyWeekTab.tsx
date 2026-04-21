"use client";

import { RoleWeekDayTimetable } from "@/components/timetable/RoleWeekDayTimetable";

export function TeacherMyWeekTab({
  teacher,
}: {
  teacher: {
    id: string;
    fullName: string;
  };
}) {
  return (
    <RoleWeekDayTimetable
      endpoint={`/api/admin/teachers/${encodeURIComponent(teacher.id)}/timetable/week`}
      title="Weekly schedule"
      subtitle={`Published timetable for ${teacher.fullName}.`}
      hideTeacherName
      noPublishedMessage="No published timetable is available for this teacher yet."
      emptyWeekMessage="No classes are scheduled for this week."
      emptyDayMessage="No classes are scheduled for this day."
    />
  );
}
