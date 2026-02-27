"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MyWeek } from "@/components/student/timetable/MyWeek";
import { isTimetableRoleReadViewsEnabled } from "@/lib/timetable/feature-flags";

export default function StudentTimetablePage() {
  if (!isTimetableRoleReadViewsEnabled()) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="py-12 text-center">
          <p className="font-semibold text-white">My Timetable Disabled</p>
          <p className="mt-1 text-sm text-white/60">
            Timetable role views are currently disabled.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">My Timetable</h1>
        <p className="mt-1 text-sm text-white/60">
          View your published schedule in week and day modes.
        </p>
      </div>

      <MyWeek />
    </div>
  );
}
