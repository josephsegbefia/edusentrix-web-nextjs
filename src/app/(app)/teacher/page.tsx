"use client";

import * as React from "react";
import { useTeacherDashboard } from "@/hooks/teacher/useTeacherDashboard";
import { useBusyToast } from "@/hooks/useBusyToast";
import { DashboardStats } from "@/components/teacher/DashboardStats";
import { TodaySchedule } from "@/components/teacher/TodaySchedule";
import { SmartQueue } from "@/components/teacher/SmartQueue";
import { QuickActions } from "@/components/teacher/QuickActions";
import { ThisWeekSchemeRows } from "@/components/teacher/ThisWeekSchemeRows";

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
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            Teacher Dashboard
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Track your classes, upcoming lessons, and priority tasks in one place.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45">
            <span className="text-white/60">Lessons</span> help you prepare and
            teach. <span className="text-white/60">Attendance</span> keeps class
            records current. <span className="text-white/60">Smart queue</span>{" "}
            highlights the work that needs your attention today.
          </p>
        </div>
        <div className="lg:pt-1">
          <QuickActions onRefresh={handleRefresh} refreshing={isFetching} />
        </div>
      </div>

      <DashboardStats stats={data?.data.stats} loading={isLoading} />

      <ThisWeekSchemeRows
        rows={data?.data.thisWeekSchemeRows}
        loading={isLoading}
        currentSchemeWeek={data?.data.currentSchemeWeek}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TodaySchedule
          date={data?.data.today.date}
          schedule={data?.data.today.schedule}
          weekSchedule={data?.data.weekSchedule}
          loading={isLoading}
        />
        <SmartQueue items={data?.data.queues} loading={isLoading} />
      </div>
    </div>
  );
}
