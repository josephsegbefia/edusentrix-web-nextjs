"use client";

import { ComingSoonPanel } from "@/components/ui/coming-soon-panel";

export default function TeacherHomeroomTimetablePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Homeroom timetable</h1>
        <p className="text-sm text-white/60">Build and review your class schedule (coming soon)</p>
      </div>
      <ComingSoonPanel
        title="Homeroom timetable"
        description="Timetable editing for homeroom classes is paused while we rebuild it. Your other teacher tools are unchanged."
      />
    </div>
  );
}
