"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  useStudentDetail,
  type StudentDetailTabId,
} from "@/hooks/admin/useStudentDetail";
import { StudentDetailHeader } from "@/components/admin/students/detail/StudentDetailHeader";
import { StudentDetailTabs } from "@/components/admin/students/detail/StudentDetailTabs";
import { StudentOverviewTab } from "@/components/admin/students/detail/StudentOverviewTab";

function getInitialTab(sp: URLSearchParams): StudentDetailTabId {
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

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const studentId = params?.studentId;
  const [activeTab, setActiveTab] = React.useState<StudentDetailTabId>(() =>
    getInitialTab(searchParams as unknown as URLSearchParams)
  );

  const { data: student, isLoading, isError } = useStudentDetail(studentId);

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
      <div className="space-y-4">
        <Card className="border border-red-500/40 bg-red-950/40 text-sm text-red-50">
          <CardContent className="flex items-center justify-between gap-3 py-4">
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
              className="border-red-300/60 bg-transparent text-xs text-red-50 hover:bg-red-900/40"
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
      <div className="space-y-4">
        {/* Header skeleton */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-r from-white/5 via-slate-900/60 to-transparent shadow-lg shadow-black/30 backdrop-blur">
          <CardContent className="flex animate-pulse items-center justify-between gap-6 p-6">
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
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            <Card className="h-40 animate-pulse border border-white/10 bg-white/5" />
          </div>
          <div className="space-y-3">
            <Card className="h-40 animate-pulse border border-white/10 bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !student) {
    return (
      <div className="space-y-4">
        <Card className="border border-red-500/40 bg-red-950/40 text-sm text-red-50">
          <CardContent className="flex items-center justify-between gap-3 py-4">
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
              className="border-red-300/60 bg-transparent text-xs text-red-50 hover:bg-red-900/40"
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
    <div className="space-y-4">
      <StudentDetailHeader student={student} />

      <div className="mt-2">
        <StudentDetailTabs value={activeTab} onChange={handleTabChange} />
      </div>

      <div className="mt-2">
        {activeTab === "overview" ? (
          <StudentOverviewTab student={student} />
        ) : (
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardContent className="py-10 text-center text-xs text-muted-foreground/80">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-primary/70" />
              <p className="mb-1 font-medium">
                This section is coming online soon.
              </p>
              <p className="text-[11px]">
                We&apos;ll wire up the{" "}
                <span className="font-semibold">{activeTab}</span> tab with full
                data (fees, academics, behaviour, etc.) in the next steps.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
