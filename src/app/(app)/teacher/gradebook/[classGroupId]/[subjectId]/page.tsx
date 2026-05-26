"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  BookOpenCheck,
  CheckCircle2,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useTeacherGradebook, type GradebookAssessment } from "@/hooks/teacher/useTeacherGradebook";
import { useTeacherGradebookAssessments } from "@/hooks/teacher/useTeacherGradebookAssessments";
import { useTeacherGradebookRecord } from "@/hooks/teacher/useTeacherGradebookRecord";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { GradebookGrid } from "@/components/teacher/gradebook/GradebookGrid";
import { GradePreview } from "@/components/teacher/gradebook/GradePreview";
import { PublishModal } from "@/components/teacher/gradebook/PublishModal";
import { ExportButton } from "@/components/teacher/gradebook/ExportButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";

type AssessmentType = "ca" | "quiz" | "assignment" | "midterm" | "exam" | "project" | "mock";

const DEFAULT_ASSESSMENT = {
  title: "",
  type: "ca",
  maxScore: 100,
};

function buildAssessmentKey(assessment: {
  type: string;
  title: string;
  maxScore: number;
  weight?: number | null;
}) {
  const weight = assessment.weight ?? 1;
  return `${assessment.type}::${assessment.title}::${assessment.maxScore}::${weight}`;
}

export default function TeacherGradebookDetailPage() {
  const params = useParams<{ classGroupId: string; subjectId: string }>();
  const classGroupId = params?.classGroupId;
  const subjectId = params?.subjectId;

  const busyToast = useBusyToast();
  const recordMutation = useTeacherGradebookRecord();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.gradebookView);
  const canRecord = can(permissions, PERMISSIONS.gradebookRecord);
  const canPublish = can(permissions, PERMISSIONS.gradebookPublish);
  const canExport = can(permissions, PERMISSIONS.gradebookExport);

  const {
    data: gradebookData,
    isLoading,
    refetch,
    isFetching,
  } = useTeacherGradebook(classGroupId, subjectId);
  const { data: metaData } = useTeacherGradebookAssessments();

  const [draftAssessments, setDraftAssessments] = React.useState<GradebookAssessment[]>([]);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newAssessment, setNewAssessment] = React.useState({ ...DEFAULT_ASSESSMENT });

  const gradebook = gradebookData?.data;
  const assessmentTypes = metaData?.data.assessmentTypes || [];
  const gradingScale = metaData?.data.gradingScale || null;

  const assessmentIds = React.useMemo(() => {
    const ids = new Set<string>();
    gradebook?.assessmentScheme.categories?.forEach((category) => {
      category.assessments.forEach((assessment) => ids.add(assessment.id));
    });
    return ids;
  }, [gradebook?.assessmentScheme.categories]);

  React.useEffect(() => {
    if (!assessmentIds.size) return;
    setDraftAssessments((prev) => prev.filter((assessment) => !assessmentIds.has(assessment.id)));
  }, [assessmentIds]);

  const [savingCells, setSavingCells] = React.useState<Set<string>>(() => new Set());

  const isCellSaving = React.useCallback(
    (studentId: string, assessmentId: string) => savingCells.has(`${studentId}::${assessmentId}`),
    [savingCells]
  );

  const handleRecord = React.useCallback(
    async (assessment: GradebookAssessment, studentId: string, score: number | null) => {
      if (!classGroupId || !subjectId) return;
      if (!canRecord) return;

      const key = `${studentId}::${assessment.id}`;
      setSavingCells((prev) => new Set(prev).add(key));
      try {
        await recordMutation.mutateAsync({
          classGroupId,
          subjectId,
          assessment: {
            assessmentType: assessment.type as AssessmentType,
            title: assessment.title,
            maxScore: assessment.maxScore,
            weight: assessment.weight,
          },
          records: [{ studentId, score }],
        });
      } catch (err) {
        busyToast.error(err instanceof Error ? err.message : "Failed to save mark");
      } finally {
        setSavingCells((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [classGroupId, subjectId, canRecord, recordMutation, busyToast]
  );

  const handleRefresh = async () => {
    await busyToast.promise(
      refetch().then((result) => {
        if (result.error) throw result.error;
        return result;
      }),
      {
        loading: "Refreshing gradebook...",
        success: "Gradebook updated",
        error: "Failed to refresh gradebook",
      }
    );
  };

  const handlePublish = async () => {
    if (!classGroupId || !subjectId) return;
    await busyToast.promise(
      fetch(`/api/teacher/gradebook/${classGroupId}/${subjectId}/publish`, {
        method: "POST",
      }).then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to publish grades");
        }
        return data;
      }),
      {
        loading: "Publishing grades...",
        success: "Grades published",
        error: "Failed to publish grades",
      }
    );
    setPublishOpen(false);
    await refetch();
  };

  const handleAddAssessment = () => {
    const title = newAssessment.title.trim();
    const maxScore = Number(newAssessment.maxScore);

    if (!title) {
      busyToast.error("Assessment title is required");
      return;
    }

    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      busyToast.error("Max score must be greater than zero");
      return;
    }

    const newEntry: GradebookAssessment = {
      id: buildAssessmentKey({
        type: newAssessment.type,
        title,
        maxScore,
        weight: 1,
      }),
      title,
      maxScore,
      type: newAssessment.type,
      weight: 1,
    };

    const existsInServer = assessmentIds.has(newEntry.id);
    const existsInDraft = draftAssessments.some((assessment) => assessment.id === newEntry.id);
    if (existsInServer || existsInDraft) {
      busyToast.error("That assessment already exists in this gradebook");
      return;
    }

    setDraftAssessments((prev) => [...prev, newEntry]);
    setNewAssessment({ ...DEFAULT_ASSESSMENT });
    setAddOpen(false);
  };

  const classLabel = gradebook?.classGroup.name ?? "Class";
  const subjectLabel = gradebook?.subject.name ?? "Subject";
  const studentCount = gradebook?.students?.length ?? 0;

  const headerActions = (
    <>
      <Button
        variant="outline"
        onClick={handleRefresh}
        disabled={isFetching}
        className={glassSecondaryButtonClass}
      >
        <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        Refresh
      </Button>
      {canRecord ? (
        <Button onClick={() => setAddOpen(true)} className={glassPrimaryButtonClass}>
          <Plus className="h-4 w-4" />
          Add assessment
        </Button>
      ) : null}
      {canPublish ? (
        <Button
          onClick={() => setPublishOpen(true)}
          className="border border-emerald-400/30 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
        >
          <CheckCircle2 className="h-4 w-4" />
          Publish grades
        </Button>
      ) : null}
      {canExport && classGroupId && subjectId ? (
        <ExportButton
          classGroupId={classGroupId}
          subjectId={subjectId}
          classLabel={gradebook?.classGroup.name}
          subjectLabel={gradebook?.subject.name}
        />
      ) : null}
    </>
  );

  if (!canView) {
    return (
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={BookOpenCheck}
          title="Gradebook"
          subtitle="Gradebook access is not enabled for your role."
          backHref="/teacher/gradebook"
          backLabel="Back to gradebooks"
        />
        <GlassPanel className="p-6">
          <p className="text-sm text-white/60">
            Ask your admin to grant gradebook permissions before recording marks.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  const assessmentCategories = gradebook?.assessmentScheme.categories ?? [];
  const allAssessments = assessmentCategories.flatMap((category) => category.assessments);
  const hasAssessments = allAssessments.length > 0 || draftAssessments.length > 0;

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={BookOpenCheck}
        title="Gradebook"
        subtitle={`${classLabel} · ${subjectLabel}`}
        backHref="/teacher/gradebook"
        backLabel="Back to gradebooks"
        badge={
          !isLoading && studentCount > 0 ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {studentCount} student{studentCount === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
        actions={headerActions}
      />

      {!canRecord ? (
        <div className={cn(glassInsetClass, "rounded-2xl p-4 text-sm text-white/60")}>
          You can view grades, but recording marks is disabled for your role. Ask an admin to grant
          gradebook recording rights.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {isLoading ? (
            <div className={cn(glassInsetClass, "h-[360px] animate-pulse rounded-2xl")} />
          ) : hasAssessments ? (
            <GradebookGrid
              categories={assessmentCategories}
              students={gradebook?.students ?? []}
              canEdit={canRecord}
              onRecord={handleRecord}
              onInvalid={(message) => busyToast.error(message)}
              draftAssessments={draftAssessments}
              isCellSaving={isCellSaving}
              weights={
                gradingScale
                  ? { caWeight: gradingScale.caWeight, examWeight: gradingScale.examWeight }
                  : undefined
              }
            />
          ) : (
            <div
              className={cn(
                glassInsetClass,
                "rounded-2xl border-dashed p-8 text-center text-sm text-white/60"
              )}
            >
              No assessments have been recorded yet. Add an assessment to start capturing marks.
            </div>
          )}
        </div>
        <div className="space-y-4">
          <GradePreview scale={gradingScale} />
          <GlassPanel className="p-5" glow="cyan">
            <h3 className="text-base font-semibold text-white">Tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>Use Tab to move across the grid and Enter to save a cell.</li>
              <li>Draft scores stay amber until you publish.</li>
            </ul>
          </GlassPanel>
        </div>
      </div>

      <PublishModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={handlePublish}
        classLabel={gradebook?.classGroup.name}
        subjectLabel={gradebook?.subject.name}
        pending={false}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950/95 to-black/95 text-white backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Add assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Title
              </label>
              <Input
                value={newAssessment.title}
                onChange={(event) =>
                  setNewAssessment((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="e.g. Unit Test 1"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Type
                </label>
                <PremiumSelect
                  value={newAssessment.type}
                  onValueChange={(value) => setNewAssessment((prev) => ({ ...prev, type: value }))}
                >
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select type" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {assessmentTypes.map((type) => (
                      <PremiumSelectItem key={type.value} value={type.value}>
                        {type.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Max score
                </label>
                <Input
                  type="number"
                  min={1}
                  value={newAssessment.maxScore}
                  onChange={(event) =>
                    setNewAssessment((prev) => ({
                      ...prev,
                      maxScore: Number(event.target.value),
                    }))
                  }
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className={glassSecondaryButtonClass}
            >
              Cancel
            </Button>
            <Button onClick={handleAddAssessment} className={glassPrimaryButtonClass}>
              Add assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspacePageShell>
  );
}
