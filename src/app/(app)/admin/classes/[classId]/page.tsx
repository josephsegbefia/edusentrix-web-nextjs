// src/app/(app)/admin/classes/[classId]/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, School, Sparkles, Edit, MoreHorizontal } from "lucide-react";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
} from "@/components/ui/premium-dropdown-menu";
import { useClassDetail } from "@/hooks/admin/useClasses";
import { ClassDetailHeader } from "@/components/admin/classes/detail/ClassDetailHeader";
import {
  ClassDetailTabs,
  getValidClassTab,
  type ClassDetailTabId,
} from "@/components/admin/classes/detail/ClassDetailTabs";
import { ClassOverviewTab } from "@/components/admin/classes/detail/ClassOverviewTab";
import { ClassStudentsTab } from "@/components/admin/classes/detail/ClassStudentsTab";
import { ClassSubjectsTeachersTab } from "@/components/admin/classes/detail/ClassSubjectsTeachersTab";
import { ClassScheduleTab } from "@/components/admin/classes/detail/ClassScheduleTab";
import { ClassRolesTab } from "@/components/admin/classes/detail/ClassRolesTab";
import { ClassAttendanceTab } from "@/components/admin/classes/detail/ClassAttendanceTab";
import { ClassPerformanceTab } from "@/components/admin/classes/detail/ClassPerformanceTab";
import { ClassFeesTab } from "@/components/admin/classes/detail/ClassFeesTab";
import { ClassSettingsTab } from "@/components/admin/classes/detail/ClassSettingsTab";
import { AssignHomeroomModal } from "@/components/modals/AssignHomeroomModal";
import { AssignSubjectsToClassModal } from "@/components/modals/AssignSubjectsToClassModal";
import { SubjectTeacherAssignmentWizard } from "@/components/modals/SubjectTeacherAssignmentWizard";
import { AddStudentToClassModal } from "@/components/modals/AddStudentToClassModal";
import { AssignClassRoleModal } from "@/components/modals/AssignClassRoleModal";

function ClassDetailContent() {
  const params = useParams<{ classId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const classId = params?.classId;
  const [activeTab, setActiveTab] = React.useState<ClassDetailTabId>(() =>
    getValidClassTab(searchParams.get("tab"))
  );

  // Modals
  const [assignHomeroomOpen, setAssignHomeroomOpen] = React.useState(false);
  const [assignSubjectsOpen, setAssignSubjectsOpen] = React.useState(false);
  const [assignmentWizardOpen, setAssignmentWizardOpen] = React.useState(false);
  const [addStudentOpen, setAddStudentOpen] = React.useState(false);
  const [assignRoleOpen, setAssignRoleOpen] = React.useState(false);

  const { data, isLoading, isError } = useClassDetail(classId);
  const classData = data?.data;

  // Sync tab → URL
  React.useEffect(() => {
    if (!classId) return;
    const current = new URLSearchParams(searchParams.toString());
    current.set("tab", activeTab);
    const qs = current.toString();
    router.replace(
      qs
        ? `/admin/classes/${encodeURIComponent(classId)}?${qs}`
        : `/admin/classes/${encodeURIComponent(classId)}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, classId]);

  function handleTabChange(tab: ClassDetailTabId) {
    setActiveTab(tab);
  }

  if (!classId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Missing class identifier
                </div>
                <p className="text-xs text-red-200/70">
                  The class ID was not provided in the URL.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/grades")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Grades
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
            className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
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
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="flex animate-pulse flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="h-20 w-20 rounded-2xl bg-white/10" />
              <div className="space-y-3">
                <div className="h-8 w-48 rounded bg-white/15" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded-full bg-white/10" />
                  <div className="h-5 w-24 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
            <div className="hidden w-64 space-y-3 md:block">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded-xl bg-white/10" />
                <div className="h-20 rounded-xl bg-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-10 w-28 shrink-0 animate-pulse rounded-xl bg-white/10"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !classData) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Unable to load class details
                </div>
                <p className="text-xs text-red-200/70">
                  The class might not exist or you might not have access.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/grades")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Grades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backToGradeHref = classData?.grade?.id
    ? `/admin/grades/${classData.grade.id}`
    : "/admin/grades";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        {/* Decorative blurs */}
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-green-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push(backToGradeHref)}
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="bg-gradient-to-r from-emerald-200 via-green-200 to-teal-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Class Details
                </h1>
                {classData.isActive && (
                  <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <Sparkles className="h-3 w-3" />
                    Active
                  </div>
                )}
              </div>
              <p className="text-sm text-white/60">
                View and manage class information, students, and assignments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(backToGradeHref)}
              className="gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <School className="h-3.5 w-3.5" />
              {classData?.grade?.id ? "Back to Grade" : "All Grades"}
            </Button>
            <PremiumDropdownMenu>
              <PremiumDropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PremiumDropdownMenuTrigger>
              <PremiumDropdownMenuContent
                align="end"
                className="min-w-[160px] border border-white/10 bg-slate-900/95 text-xs text-slate-50 backdrop-blur-xl"
              >
                <PremiumDropdownMenuItem className="cursor-pointer gap-2">
                  <Edit className="h-3.5 w-3.5" />
                  Edit Class
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuSeparator className="bg-white/10" />
                <PremiumDropdownMenuItem
                  onClick={() => setAssignHomeroomOpen(true)}
                  className="cursor-pointer gap-2"
                >
                  Assign Homeroom
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuItem
                  onClick={() => setAssignSubjectsOpen(true)}
                  className="cursor-pointer gap-2"
                >
                  Manage Subjects
                </PremiumDropdownMenuItem>
              </PremiumDropdownMenuContent>
            </PremiumDropdownMenu>
          </div>
        </div>
      </div>

      {/* Class Header */}
      <ClassDetailHeader classData={classData} />

      {/* Tabs Navigation */}
      <ClassDetailTabs value={activeTab} onChange={handleTabChange} />

      {/* Tab Content */}
      <div>
        {activeTab === "overview" ? (
          <ClassOverviewTab
            classData={classData}
            onAddStudent={() => setActiveTab("students")}
            onManageSubjects={() => setAssignSubjectsOpen(true)}
            onAssignHomeroom={() => setAssignHomeroomOpen(true)}
          />
        ) : activeTab === "students" ? (
          <ClassStudentsTab
            classId={classData.id}
            className={classData.fullLabel}
            onAddStudent={() => setAddStudentOpen(true)}
          />
        ) : activeTab === "subjects" ? (
          <ClassSubjectsTeachersTab
            classId={classData.id}
            className={classData.fullLabel}
            gradeId={classData.grade?.id}
            subjects={classData.subjects || []}
            onManageSubjects={() => setAssignSubjectsOpen(true)}
            onOpenAssignmentWizard={() => setAssignmentWizardOpen(true)}
          />
        ) : activeTab === "schedule" ? (
          <ClassScheduleTab
            classId={classData.id}
            className={classData.fullLabel}
            gradeId={classData.grade?.id}
          />
        ) : activeTab === "roles" ? (
          <ClassRolesTab
            classId={classData.id}
            className={classData.fullLabel}
            onAssignRole={() => setAssignRoleOpen(true)}
          />
        ) : activeTab === "attendance" ? (
          <ClassAttendanceTab
            classId={classData.id}
            className={classData.fullLabel}
          />
        ) : activeTab === "performance" ? (
          <ClassPerformanceTab
            classId={classData.id}
            classData={classData}
          />
        ) : activeTab === "fees" ? (
          <ClassFeesTab
            classId={classData.id}
            className={classData.fullLabel}
          />
        ) : activeTab === "settings" ? (
          <ClassSettingsTab
            classData={classData}
            onAssignHomeroom={() => setAssignHomeroomOpen(true)}
            onManageSubjects={() => setAssignSubjectsOpen(true)}
            onGoStudents={() => setActiveTab("students")}
            onGoRoles={() => setActiveTab("roles")}
          />
        ) : null}
      </div>

      {/* Modals */}
      <AssignHomeroomModal
        open={assignHomeroomOpen}
        onOpenChange={setAssignHomeroomOpen}
        classGroup={classData}
      />
      <AssignSubjectsToClassModal
        open={assignSubjectsOpen}
        onOpenChange={setAssignSubjectsOpen}
        classGroup={classData}
      />
      <SubjectTeacherAssignmentWizard
        open={assignmentWizardOpen}
        onOpenChange={setAssignmentWizardOpen}
        classId={classData.id}
        className={classData.fullLabel}
        existingSubjectIds={(classData.subjects || []).map((s: { id: string }) => s.id)}
      />
      <AddStudentToClassModal
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
        classId={classData.id}
        className={classData.fullLabel}
      />
      <AssignClassRoleModal
        open={assignRoleOpen}
        onOpenChange={setAssignRoleOpen}
        classId={classData.id}
        className={classData.fullLabel}
      />
    </div>
  );
}

export default function ClassDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="relative">
            <div
              className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
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
      <ClassDetailContent />
    </Suspense>
  );
}
