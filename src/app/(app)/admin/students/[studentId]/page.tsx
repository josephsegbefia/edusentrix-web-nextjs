"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Users, Sparkles } from "lucide-react";
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
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/15 via-red-500/5 to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-500/30 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Missing student identifier
                </div>
                <p className="text-xs text-red-200/70">
                  The student ID was not provided in the URL.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/students")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
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
        {/* Page Header Skeleton */}
        <div className="relative">
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start gap-4">
            <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
            <div className="space-y-2">
              <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>

        {/* Header Card Skeleton */}
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-teal-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="flex animate-pulse flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="size-24 rounded-full bg-white/10" />
              <div className="space-y-3">
                <div className="h-6 w-48 rounded bg-white/15" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded-full bg-white/10" />
                  <div className="h-5 w-24 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <div className="hidden w-80 space-y-3 md:block">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-xl bg-white/10" />
                <div className="h-24 rounded-xl bg-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-9 w-28 shrink-0 animate-pulse rounded-xl bg-white/10"
            />
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5 lg:col-span-1" />
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5 lg:col-span-1" />
          <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5 lg:col-span-1" />
        </div>
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-500/15 via-red-500/5 to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-500/30 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Unable to load student details
                </div>
                <p className="text-xs text-red-200/70">
                  The student might not exist or you might not have access.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/students")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Students
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        {/* Decorative blurs */}
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin/students")}
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="bg-linear-to-r from-teal-200 via-cyan-200 to-sky-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Student Profile
                </h1>
                {student.status === "active" && (
                  <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <Sparkles className="h-3 w-3" />
                    Active
                  </div>
                )}
              </div>
              <p className="text-sm text-white/60">
                View and manage student information, academics, fees, and more
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/students")}
              className="gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Users className="h-3.5 w-3.5" />
              All Students
            </Button>
          </div>
        </div>
      </div>

      {/* Student Header */}
      <StudentDetailHeader student={student} />

      {/* Tabs Navigation */}
      <StudentDetailTabs value={activeTab} onChange={handleTabChange} />

      {/* Tab Content */}
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
          <div className="relative">
            <div
              className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative z-10 flex items-start gap-4">
              <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              <div className="space-y-2">
                <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
                <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <StudentDetailContent />
    </Suspense>
  );
}
