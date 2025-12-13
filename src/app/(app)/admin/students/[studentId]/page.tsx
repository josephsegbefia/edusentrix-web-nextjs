"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import {
  useStudentDetail,
  type StudentDetailTabId,
} from "@/hooks/admin/useStudentDetail";
import { useGuardianSSE } from "@/hooks/admin/useGuardianSSE";
import { StudentDetailHeader } from "@/components/admin/students/detail/StudentDetailHeader";
import { StudentDetailTabs } from "@/components/admin/students/detail/StudentDetailTabs";
import { StudentOverviewTab } from "@/components/admin/students/detail/StudentOverviewTab";
import { StudentAcademicsTab } from "@/components/admin/students/detail/StudentAcademicsTab";
import { StudentFeesTab } from "@/components/admin/students/detail/StudentFeesTab";
import { StudentBehaviourTab } from "@/components/admin/students/detail/StudentBehaviourTab";
import { StudentRelationshipsTab } from "@/components/admin/students/detail/StudentRelationshipsTab";
import { StudentActivityLogTab } from "@/components/admin/students/detail/StudentActivityLogTab";

function getInitialTab(sp: URLSearchParams | null): StudentDetailTabId {
  if (!sp) return "overview";
  const raw = sp.get("tab");
  if (
    raw === "overview" ||
    raw === "academics" ||
    raw === "fees" ||
    raw === "behaviour" ||
    raw === "relationships" ||
    raw === "activity"
  ) {
    return raw;
  }
  return "overview";
}

function StudentDetailContent() {
  const params = useParams<{ studentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const studentId = params?.studentId;
  const [activeTab, setActiveTab] = React.useState<StudentDetailTabId>(() =>
    getInitialTab(searchParams)
  );

  const { data: student, isLoading, isError } = useStudentDetail(studentId);

  // Real-time updates for guardians
  useGuardianSSE(studentId);

  // Sync tab → URL
  React.useEffect(() => {
    if (!studentId) return;
    const current = new URLSearchParams(searchParams.toString());
    current.set("tab", activeTab);
    const qs = current.toString();
    router.replace(
      qs
        ? `/admin/students/${encodeURIComponent(studentId)}?${qs}`
        : `/admin/students/${encodeURIComponent(studentId)}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, studentId]);

  function handleTabChange(tab: StudentDetailTabId) {
    setActiveTab(tab);
  }

  if (!studentId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden border border-red-500/40 bg-linear-to-br from-red-950/40 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/20 via-red-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-semibold">Missing student identifier</div>
                <p className="text-xs text-red-100/80">
                  The student ID was not provided in the URL.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/students")}
              className="cursor-pointer border border-red-300/60 bg-transparent text-xs text-red-50 transition-all duration-200 hover:scale-105 hover:border-red-300/80 hover:bg-red-900/40 hover:shadow-md hover:shadow-red-500/20 active:scale-95"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Students
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex animate-pulse items-center justify-between gap-6 p-6">
            <div className="flex flex-1 items-center gap-4">
              <div className="size-16 rounded-full bg-white/10" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-white/15" />
                <div className="flex gap-2">
                  <div className="h-3 w-24 rounded-full bg-white/10" />
                  <div className="h-3 w-20 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <div className="hidden w-64 space-y-2 md:block">
              <div className="h-3 w-full rounded bg-white/10" />
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded bg-white/10" />
                <div className="h-8 flex-1 rounded bg-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs skeleton */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <div className="h-7 w-20 rounded-full bg-white/10" />
          <div className="h-7 w-24 rounded-full bg-white/5" />
          <div className="h-7 w-32 rounded-full bg-white/5" />
        </div>

        {/* Content skeleton */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <Card className="relative overflow-hidden h-40 animate-pulse border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur" />
          </div>
          <div className="space-y-4">
            <Card className="relative overflow-hidden h-40 animate-pulse border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden border border-red-500/40 bg-linear-to-br from-red-950/40 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/20 via-red-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-semibold">
                  Unable to load student details
                </div>
                <p className="text-xs text-red-100/80">
                  The student might not exist or you might not have access.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/students")}
              className="cursor-pointer border border-red-300/60 bg-transparent text-xs text-red-50 transition-all duration-200 hover:scale-105 hover:border-red-300/80 hover:bg-red-900/40 hover:shadow-md hover:shadow-red-500/20 active:scale-95"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Students
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/students")}
            className="h-9 w-9 cursor-pointer border border-white/10 bg-white/5 transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-white/10 hover:shadow-md hover:shadow-black/20 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="mb-2 text-3xl font-bold">Student Profile</h1>
            <p className="text-muted">
              View and manage student information, academics, fees, and more
            </p>
          </div>
        </div>
      </div>

      <StudentDetailHeader student={student} />

      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-muted/10 via-muted/5 to-transparent"
          aria-hidden="true"
        />
        <CardContent className="relative z-10 p-0">
          <StudentDetailTabs value={activeTab} onChange={handleTabChange} />
        </CardContent>
      </Card>

      <div>
        {activeTab === "overview" ? (
          <StudentOverviewTab student={student} />
        ) : activeTab === "academics" ? (
          <StudentAcademicsTab studentId={studentId!} />
        ) : activeTab === "fees" ? (
          <StudentFeesTab student={student} />
        ) : activeTab === "behaviour" ? (
          <StudentBehaviourTab student={student} />
        ) : activeTab === "relationships" ? (
          <StudentRelationshipsTab student={student} />
        ) : activeTab === "activity" ? (
          <StudentActivityLogTab student={student} />
        ) : null}
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded border border-white/10 bg-white/5" />
            <div className="space-y-2">
              <div className="h-8 w-64 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>
      }
    >
      <StudentDetailContent />
    </Suspense>
  );
}
