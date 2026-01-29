"use client";

import * as React from "react";
import { useTeacherDashboard } from "@/hooks/teacher/useTeacherDashboard";
import { useBusyToast } from "@/hooks/useBusyToast";
import { TeacherHeader } from "@/components/teacher/TeacherHeader";
import { DashboardStats } from "@/components/teacher/DashboardStats";
import { TodaySchedule } from "@/components/teacher/TodaySchedule";
import { SmartQueue } from "@/components/teacher/SmartQueue";
import { QuickActions } from "@/components/teacher/QuickActions";

export default function TeacherPage() {
  const { data, isLoading, refetch, isFetching } = useTeacherDashboard();
  const busyToast = useBusyToast();

  const handleRefresh = React.useCallback(async () => {
    await busyToast.promise(
      refetch().then((result) => {
        if (result.error) throw result.error;
        return result;
      }),
      {
      loading: "Refreshing teacher dashboard...",
      success: "Dashboard refreshed",
      error: "Failed to refresh dashboard",
      }
    );
  }, [busyToast, refetch]);

  return (
    <div className="space-y-6">
      <TeacherHeader />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-white/60">
          Track your classes, upcoming lessons, and priority tasks in one place.
        </div>
        <QuickActions onRefresh={handleRefresh} refreshing={isFetching} />
      </div>

      <DashboardStats stats={data?.data.stats} loading={isLoading} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TodaySchedule
          date={data?.data.today.date}
          schedule={data?.data.today.schedule}
          loading={isLoading}
        />
        <SmartQueue items={data?.data.queues} loading={isLoading} />
      </div>
    </div>
  );
}
