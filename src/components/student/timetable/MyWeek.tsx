"use client";

import { RoleWeekDayTimetable } from "@/components/timetable/RoleWeekDayTimetable";

export function MyWeek() {
  return (
    <RoleWeekDayTimetable
      endpoint="/api/student/timetable/week"
      title="My Week"
      subtitle="Your published class timetable by week or day."
      hideClassName
      noPublishedMessage="No published timetable is available for your class yet."
      emptyWeekMessage="No classes are scheduled for this week."
      emptyDayMessage="No classes are scheduled for this day."
    />
  );
}
