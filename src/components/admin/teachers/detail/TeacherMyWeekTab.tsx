"use client";

import { ComingSoonPanel } from "@/components/ui/coming-soon-panel";

export function TeacherMyWeekTab({
  teacher,
}: {
  teacher: {
    id: string;
    fullName: string;
  };
}) {
  return (
    <ComingSoonPanel
      title="Weekly schedule"
      description={`A read-only week view for ${teacher.fullName} will return when timetables relaunch. Assignments and classes are unchanged.`}
    />
  );
}
