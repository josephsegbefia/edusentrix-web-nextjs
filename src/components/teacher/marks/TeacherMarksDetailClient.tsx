"use client";

import * as React from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Table2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinalPreviewTab } from "@/components/teacher/marks/FinalPreviewTab";
import { SubmitTab } from "@/components/teacher/marks/SubmitTab";
import { MarkEntryTab } from "@/components/teacher/marks/MarkEntryTab";
import { AssessmentItemsTab } from "@/components/teacher/marks/AssessmentItemsTab";
import { ReportContributionTab } from "@/components/teacher/marks/ReportContributionTab";
import { useTeacherGradebookV2 } from "@/hooks/teacher/useTeacherGradebookV2";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import {
  glassInsetClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { TeacherGradebookV2DTO } from "@/types/academics/assessment-engine";

const MARKS_TABS = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "items", label: "Assessment Items", icon: ClipboardList },
  { id: "marks", label: "Mark Entry", icon: Table2 },
  { id: "contribution", label: "Report Contribution", icon: SlidersHorizontal },
  { id: "preview", label: "Final Preview", icon: BookOpenCheck },
  { id: "submit", label: "Submit", icon: Send },
] as const;

type MarksTabId = (typeof MARKS_TABS)[number]["id"];

const PLAN_STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  archived: "border-white/10 bg-white/5 text-white/45",
  locked: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
};

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function NoPlanEmptyState({ gradebook }: { gradebook: TeacherGradebookV2DTO }) {
  const issue =
    gradebook.readiness.issues.find((entry) => entry.code === "NO_ASSESSMENT_PLAN") ??
    gradebook.readiness.issues[0];

  return (
    <GlassPanel className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10">
        <AlertTriangle className="h-5 w-5 text-amber-200" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">No active assessment plan</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/60">
        {issue?.message ??
          "Your school admin needs to activate an assessment plan for this class, subject, and term before you can record official marks here."}
      </p>
      <p className="mx-auto mt-3 max-w-lg text-xs text-white/45">
        Ask your school admin to publish a grading policy and assessment plan for this term. The
        retired legacy gradebook no longer accepts official mark submissions.
      </p>
    </GlassPanel>
  );
}

function OverviewTab({ gradebook }: { gradebook: TeacherGradebookV2DTO }) {
  const components = gradebook.gradingPolicy?.scoreComponents ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <GlassPanel className="p-4" glow="teal">
        <p className="text-xs uppercase tracking-wide text-white/45">Students</p>
        <p className="mt-2 text-2xl font-semibold text-white">{gradebook.students.length}</p>
      </GlassPanel>
      <GlassPanel className="p-4" glow="cyan">
        <p className="text-xs uppercase tracking-wide text-white/45">Assessment items</p>
        <p className="mt-2 text-2xl font-semibold text-white">
          {gradebook.assessmentItems.length}
        </p>
      </GlassPanel>
      <GlassPanel className="p-4">
        <p className="text-xs uppercase tracking-wide text-white/45">Readiness</p>
        <p className="mt-2 text-sm text-white/75">
          {gradebook.readiness.canSubmit
            ? "Ready to submit when mark entry is complete."
            : "Complete required items and scores before submission."}
        </p>
      </GlassPanel>

      <GlassPanel className="p-4 sm:p-5 lg:col-span-2">
        <h3 className="text-base font-semibold text-white">Assessment plan</h3>
        {gradebook.assessmentPlan ? (
          <div className="mt-4 space-y-2 text-sm text-white/70">
            <p>
              <span className="text-white/45">Name:</span> {gradebook.assessmentPlan.name}
            </p>
            <p>
              <span className="text-white/45">Status:</span>{" "}
              {formatStatus(gradebook.assessmentPlan.status)}
            </p>
            <p>
              <span className="text-white/45">Permissions:</span>{" "}
              {gradebook.assessmentPlan.teacherCanCreateReportItems
                ? "Teachers can create report items"
                : "Report item creation disabled"}
              {" · "}
              {gradebook.assessmentPlan.allowOfflineMarks
                ? "Offline marks allowed"
                : "Offline marks disabled"}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/55">No assessment plan linked yet.</p>
        )}
      </GlassPanel>

      <GlassPanel className="p-4 sm:p-5">
        <h3 className="text-base font-semibold text-white">Grading policy</h3>
        {gradebook.gradingPolicy ? (
          <div className="mt-4 space-y-2 text-sm text-white/70">
            <p>{gradebook.gradingPolicy.name}</p>
            <p className="text-xs text-white/50">
              {components
                .map((component) => `${component.label} ${component.weight}%`)
                .join(" · ")}
            </p>
            <p className="text-xs text-white/45">
              Pass mark {gradebook.gradingPolicy.passMark}%
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/55">No grading policy linked yet.</p>
        )}
      </GlassPanel>

      <GlassPanel className="p-4 sm:p-5 lg:col-span-3">
        <h3 className="text-base font-semibold text-white">Readiness checklist</h3>
        <ul className="mt-4 space-y-2">
          {gradebook.readiness.checklist.map((item) => (
            <li
              key={item.key}
              className={cn(
                glassInsetClass,
                "flex items-center justify-between px-3 py-2 text-sm"
              )}
            >
              <span className="text-white/75">{item.label}</span>
              {item.complete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              )}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}

type TeacherMarksDetailClientProps = {
  classGroupId: string;
  subjectId: string;
};

export function TeacherMarksDetailClient({
  classGroupId,
  subjectId,
}: TeacherMarksDetailClientProps) {
  const busy = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canRecord = can(permissions, PERMISSIONS.gradebookRecord);
  const canPublish = can(permissions, PERMISSIONS.gradebookPublish);
  const [activeTab, setActiveTab] = React.useState<MarksTabId>("overview");
  const { data, isLoading, error, refetch, isFetching } = useTeacherGradebookV2(
    classGroupId,
    subjectId
  );

  const gradebook = data?.data;
  const hasActivePlan = Boolean(gradebook?.assessmentPlan?.status === "active");

  const handleRefresh = async () => {
    await busy.promise(
      refetch().then((result) => {
        if (result.error) throw result.error;
        return result;
      }),
      {
        loading: "Refreshing marks workspace…",
        success: "Marks workspace updated.",
        error: "Failed to refresh marks workspace.",
      }
    );
  };

  const classLabel = gradebook?.classGroup.label ?? gradebook?.classGroup.name ?? "Class";
  const subjectLabel = gradebook?.subject.name ?? "Subject";
  const periodLabel = gradebook?.academicPeriod
    ? `${gradebook.academicPeriod.yearLabel} · ${gradebook.academicPeriod.term}`
    : "No current period";

  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
      <WorkspacePageShell>
        <WorkspacePageHeader
          iconName="book-open-check"
          title="Marks & Reports"
          subtitle={`${classLabel} · ${subjectLabel} · ${periodLabel}`}
          backHref="/teacher/marks"
          backLabel="Back to marks"
          badge={
            gradebook?.assessmentPlan ? (
              <Badge
                variant="outline"
                className={
                  PLAN_STATUS_STYLES[gradebook.assessmentPlan.status] ?? PLAN_STATUS_STYLES.draft
                }
              >
                Plan {formatStatus(gradebook.assessmentPlan.status)}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 text-amber-100">
                No active plan
              </Badge>
            )
          }
          actions={
            <Button
              type="button"
              variant="outline"
              className={glassSecondaryButtonClass}
              onClick={() => void handleRefresh()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        {gradebook?.gradingPolicy ? (
          <div className={cn(glassInsetClass, "flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-sm text-white/65")}>
            <span>
              <span className="text-white/40">Plan:</span> {gradebook.assessmentPlan?.name ?? "—"}
            </span>
            <span>
              <span className="text-white/40">Policy:</span> {gradebook.gradingPolicy.name}
            </span>
            <span>
              <span className="text-white/40">Students:</span> {gradebook.students.length}
            </span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-white/60">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading marks workspace…
          </div>
        ) : error ? (
          <GlassPanel className="p-6 text-center">
            <p className="text-sm text-rose-200">
              {error instanceof Error ? error.message : "Failed to load marks workspace."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("mt-4", glassSecondaryButtonClass)}
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </GlassPanel>
        ) : !gradebook ? null : !hasActivePlan ? (
          <NoPlanEmptyState gradebook={gradebook} />
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MarksTabId)}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
              {MARKS_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="rounded-xl border border-transparent px-3 py-2 text-white/60 data-[state=active]:border-teal-400/20 data-[state=active]:bg-teal-500/10 data-[state=active]:text-teal-100"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <OverviewTab gradebook={gradebook} />
            </TabsContent>
            <TabsContent value="items" className="mt-4">
              <AssessmentItemsTab
                gradebook={gradebook}
                classGroupId={classGroupId}
                subjectId={subjectId}
                canRecord={canRecord}
                onRefresh={() => void refetch()}
              />
            </TabsContent>
            <TabsContent value="marks" className="mt-4">
              <MarkEntryTab
                gradebook={gradebook}
                classGroupId={classGroupId}
                subjectId={subjectId}
                canRecord={canRecord}
                onSaved={() => void refetch()}
              />
            </TabsContent>
            <TabsContent value="contribution" className="mt-4">
              <ReportContributionTab
                gradebook={gradebook}
                classGroupId={classGroupId}
                subjectId={subjectId}
                canRecord={canRecord}
                onRefresh={() => void refetch()}
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-4">
              <FinalPreviewTab
                classGroupId={classGroupId}
                subjectId={subjectId}
                academicPeriodId={gradebook.academicPeriod?._id}
                gradingPolicy={gradebook.gradingPolicy}
                enabled={activeTab === "preview"}
              />
            </TabsContent>
            <TabsContent value="submit" className="mt-4">
              <SubmitTab
                gradebook={gradebook}
                classGroupId={classGroupId}
                subjectId={subjectId}
                academicPeriodId={gradebook.academicPeriod?._id}
                canPublish={canPublish}
                enabled={activeTab === "submit"}
                onSubmitted={() => void refetch()}
              />
            </TabsContent>
          </Tabs>
        )}
      </WorkspacePageShell>
    </div>
  );
}
