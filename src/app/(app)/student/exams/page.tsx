"use client";

import { PublishedExamTimetableView } from "@/components/exams/PublishedExamTimetableView";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { useStudentExamTimetable } from "@/hooks/student/useStudentExamTimetable";

export default function StudentExamsPage() {
  const timetableQuery = useStudentExamTimetable();

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6">
      <WorkspacePageShell>
        <WorkspacePageHeader
          iconName="calendar-check-2"
          title="Upcoming Exams"
          subtitle="Your published exam dates, times, venues, and instructions."
        />
        <PublishedExamTimetableView
          data={timetableQuery.data?.data}
          loading={timetableQuery.isLoading}
          errorMessage={
            timetableQuery.isError
              ? timetableQuery.error instanceof Error
                ? timetableQuery.error.message
                : "Failed to load exam timetable"
              : null
          }
          onRefresh={() => void timetableQuery.refetch()}
          isRefreshing={timetableQuery.isFetching}
        />
      </WorkspacePageShell>
    </div>
  );
}
