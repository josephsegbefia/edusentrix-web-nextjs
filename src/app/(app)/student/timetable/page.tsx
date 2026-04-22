"use client";

import { ComingSoonPanel } from "@/components/ui/coming-soon-panel";

export default function StudentTimetablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">My Timetable</h1>
        <p className="mt-1 text-sm text-white/60">Your weekly class schedule (coming soon)</p>
      </div>
      <ComingSoonPanel
        title="My timetable"
        description="A student-friendly schedule view will return in a future update."
      />
    </div>
  );
}
