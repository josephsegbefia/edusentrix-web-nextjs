"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TimetableCenterShell } from "@/components/admin/timetable/TimetableCenterShell";
import {
  isTimetableAdminPlannerEnabled,
  isTimetableRebootEnabled,
} from "@/lib/timetable/feature-flags";

export default function MasterTimetablePage() {
  if (!isTimetableRebootEnabled() || !isTimetableAdminPlannerEnabled()) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="py-12 text-center">
          <p className="text-base font-semibold text-white">Timetable Planner Disabled</p>
          <p className="mt-1 text-sm text-white/60">
            Enable timetable reboot and admin planner feature flags to use this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <TimetableCenterShell />;
}
