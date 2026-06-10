"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useParentDashboard } from "@/hooks/parent";
import { RoleWeekDayTimetable } from "@/components/timetable/RoleWeekDayTimetable";

export function WardTimetable({ wardId, wardName }: { wardId: string; wardName: string }) {
  const router = useRouter();
  const { data } = useParentDashboard();

  const wards = data?.wards || [];

  const selectedWardId = wards.some((ward) => ward.id === wardId)
    ? wardId
    : wards[0]?.id || wardId;

  const handleWardChange = (nextWardId: string) => {
    router.push(`/parent/wards/${encodeURIComponent(nextWardId)}?tab=timetable`);
  };

  return (
    <div className="space-y-4">
      {wards.length > 1 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white/70">Switch ward to view another child&apos;s profile</p>
              <Select value={selectedWardId} onValueChange={handleWardChange}>
                <SelectTrigger className="w-full border-white/15 bg-black/20 text-white sm:w-72">
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {wards.map((ward) => (
                    <SelectItem key={ward.id} value={ward.id}>
                      {ward.name} {ward.classGroup ? `(${ward.classGroup})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <RoleWeekDayTimetable
        endpoint={`/api/parent/wards/${encodeURIComponent(wardId)}/timetable/week`}
        title={`${wardName}'s Timetable`}
        subtitle="Published class timetable for this ward."
        hideClassName
        noPublishedMessage="No published timetable is available for this ward's class yet."
        emptyWeekMessage="No classes are scheduled for this ward this week."
        emptyDayMessage="No classes are scheduled for this ward on this day."
      />
    </div>
  );
}
