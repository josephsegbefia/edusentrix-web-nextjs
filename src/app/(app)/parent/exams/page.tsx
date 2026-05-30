"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { PublishedExamTimetableView } from "@/components/exams/PublishedExamTimetableView";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { useParentWardExamTimetable } from "@/hooks/parent/useParentWardExamTimetable";
import { useParentWards } from "@/hooks/parent/useParentDashboard";

function ParentExamsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wardIdFromUrl = searchParams.get("wardId");
  const wardsQuery = useParentWards();
  const wards = wardsQuery.data?.wards ?? [];
  const selectedWardId = wardIdFromUrl || wards[0]?.studentId || null;

  const timetableQuery = useParentWardExamTimetable(selectedWardId);

  React.useEffect(() => {
    if (!wardIdFromUrl && wards[0]?.studentId) {
      router.replace(`/parent/exams?wardId=${encodeURIComponent(wards[0].studentId)}`, {
        scroll: false,
      });
    }
  }, [wardIdFromUrl, wards, router]);

  const selectedWard = wards.find((ward) => ward.studentId === selectedWardId);

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6">
      <WorkspacePageShell>
        <WorkspacePageHeader
          iconName="calendar-check-2"
          title="Upcoming Exams"
          subtitle="Published exam timetable for your child. Only official published schedules are shown here."
        />

        {wards.length > 1 ? (
          <div className="max-w-md">
            <PremiumSelect
              value={selectedWardId ?? undefined}
              onValueChange={(value) => {
                router.replace(`/parent/exams?wardId=${encodeURIComponent(value)}`, {
                  scroll: false,
                });
              }}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select child" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {wards.map((ward) => (
                  <PremiumSelectItem key={ward.studentId} value={ward.studentId}>
                    {ward.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        ) : selectedWard ? (
          <p className="text-sm text-white/60">Showing exams for {selectedWard.name}</p>
        ) : null}

        <PublishedExamTimetableView
          data={timetableQuery.data?.data}
          loading={wardsQuery.isLoading || timetableQuery.isLoading}
          errorMessage={
            timetableQuery.isError
              ? timetableQuery.error instanceof Error
                ? timetableQuery.error.message
                : "Failed to load exam timetable"
              : null
          }
          onRefresh={() => void timetableQuery.refetch()}
          isRefreshing={timetableQuery.isFetching}
          emptyDescription="When the school publishes an exam timetable and enables parent visibility, it will appear here."
        />
      </WorkspacePageShell>
    </div>
  );
}

export default function ParentExamsPage() {
  return (
    <Suspense fallback={null}>
      <ParentExamsPageContent />
    </Suspense>
  );
}
