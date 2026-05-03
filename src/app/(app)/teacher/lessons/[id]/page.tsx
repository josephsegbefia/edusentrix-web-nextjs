"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Presentation,
  ExternalLink,
  Trash2,
  CalendarDays,
  MonitorPlay,
  Users,
  ListTree,
} from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherLesson } from "@/hooks/teacher/useTeacherLesson";
import { useTeacherLessonUpdate } from "@/hooks/teacher/useTeacherLessonUpdate";
import { useTeacherLessonDelete } from "@/hooks/teacher/useTeacherLessonDelete";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import {
  LESSON_STATUS_COLORS,
  LESSON_STATUS_LABELS,
  type LessonDeliveryStatus,
} from "@/types/lessons";
import { TeacherLessonResourcesPanel } from "@/components/lessons/TeacherLessonResourcesPanel";
import { TeacherLessonFlashcardsPanel } from "@/components/lessons/TeacherLessonFlashcardsPanel";
import { TeacherLessonReflectionPanel } from "@/components/lessons/TeacherLessonReflectionPanel";
import { TeacherLessonLeoPanel } from "@/components/lessons/TeacherLessonLeoPanel";
import { TeacherLessonAuditPanel } from "@/components/lessons/TeacherLessonAuditPanel";
import { TeacherLessonCollaborationPanel } from "@/components/lessons/TeacherLessonCollaborationPanel";

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildClassLabelMap(
  classes: Array<{ _id?: string; name: string; gradeName?: string }>
) {
  const map = new Map<string, string>();
  classes.forEach((c) => {
    if (!c._id) return;
    const label = `${c.gradeName ? c.gradeName + " " : ""}${c.name}`.trim();
    map.set(c._id, label || c.name);
  });
  return map;
}

export default function TeacherLessonDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lessonId = typeof params?.id === "string" ? params.id : null;
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data: ctx } = useTeacherContext();
  const permissions = ctx?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.lessonsRead);
  const canWrite = can(permissions, PERMISSIONS.lessonsUpdate);
  const canCreateAssignments = can(permissions, PERMISSIONS.assignmentsCreate);

  const { data: classesData } = useTeacherClasses();
  const classLabelMap = React.useMemo(
    () => buildClassLabelMap(classesData?.data.classes || []),
    [classesData]
  );

  const { data, isLoading, error, refetch } = useTeacherLesson(lessonId, canView);
  const lesson = data?.data;

  const updateMutation = useTeacherLessonUpdate();
  const deleteMutation = useTeacherLessonDelete();

  const [title, setTitle] = React.useState("");
  const [scheduled, setScheduled] = React.useState<Date | null>(null);
  const [status, setStatus] = React.useState<LessonDeliveryStatus>("draft");

  React.useEffect(() => {
    if (!lesson) return;
    setTitle(lesson.title);
    setStatus(lesson.status);
    setScheduled(lesson.scheduledAt ? new Date(lesson.scheduledAt) : null);
  }, [lesson]);

  const saveBasics = async () => {
    if (!lessonId || !lesson) return;
    await busyToast.promise(
      updateMutation.mutateAsync({
        id: lessonId,
        title: title.trim() || lesson.title,
        scheduledAt: scheduled ? toDateKey(scheduled) : null,
      }),
      { loading: "Saving…", success: "Saved", error: (e) => (e instanceof Error ? e.message : "Failed") }
    );
    refetch();
  };

  const handleStatusChange = async (next: LessonDeliveryStatus) => {
    if (!lessonId) return;
    if (next === "published" && status !== "published") {
      const r = await confirm({
        title: "Publish lesson?",
        description:
          "Students in this class will see the published lesson note, student-visible resources, and flashcards you add here. You can archive the lesson later.",
        confirmLabel: "Publish",
        cancelLabel: "Cancel",
        intent: "default",
      });
      if (r !== "confirm") return;
    }
    await busyToast.promise(
      updateMutation.mutateAsync({ id: lessonId, status: next }),
      {
        loading: "Updating status…",
        success:
          next === "published"
            ? "Lesson published"
            : next === "archived"
              ? "Lesson archived"
              : "Status updated",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      }
    );
    refetch();
  };

  const handleDelete = async () => {
    if (!lessonId || !lesson || lesson.status !== "draft") return;
    const r = await confirm({
      title: "Delete lesson",
      description: `Remove “${lesson.title}”? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (r !== "confirm") return;
    await busyToast.promise(deleteMutation.mutateAsync(lessonId), {
      loading: "Deleting…",
      success: "Lesson deleted",
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
    router.push("/teacher/lessons");
  };

  if (!canView) {
    return (
      <Card className="border border-white/10 bg-white/5">
        <CardContent className="p-6 text-sm text-white/60">No access.</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-rose-500/20 bg-rose-500/10">
        <CardContent className="p-5 text-sm text-rose-100">
          {error.message || "Failed to load lesson."}
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !lesson) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ))}
      </div>
    );
  }

  const classLabel = classLabelMap.get(lesson.classGroupId) || "Class";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/teacher/lessons">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              All lessons
            </Button>
          </Link>
          <Badge
            className={cn(
              "rounded-full capitalize",
              LESSON_STATUS_COLORS[lesson.status] || "bg-white/10 text-white/70"
            )}
          >
            {LESSON_STATUS_LABELS[lesson.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/teacher/lesson-notes/${lesson.lessonNoteId}`}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Lesson note
            </Button>
          </Link>
          {lesson.publishedSnapshot != null &&
            (lesson.status === "published" || lesson.status === "archived") && (
              <Link href={`/teacher/lessons/${lesson.id}/teach`}>
                <Button
                  type="button"
                  size="sm"
                  className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
                >
                  <MonitorPlay className="mr-2 h-4 w-4" />
                  Teaching Mode
                </Button>
              </Link>
            )}
          {canCreateAssignments && (
            <>
              <Link href={`/teacher/studio/assignments/new?lessonId=${encodeURIComponent(lesson.id)}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                >
                  Create assignment
                </Button>
              </Link>
              <Link href={`/teacher/studio/quizzes/new?lessonId=${encodeURIComponent(lesson.id)}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                >
                  Create quiz
                </Button>
              </Link>
            </>
          )}
          {lesson.status === "draft" && canWrite && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
            <Presentation className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Lesson</h1>
            <p className="text-sm text-white/55">
              {classLabel}
              {lesson.lessonNoteTopic ? ` · ${lesson.lessonNoteTopic}` : ""}
            </p>
          </div>
        </div>
      </div>

      {lesson.schemeId ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm">
          <ListTree className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <div>
            <p className="font-medium text-white">Scheme alignment</p>
            <p className="mt-0.5 text-white/65">
              This lesson is linked to a scheme of work
              {(lesson.schemeItemIds?.length ?? 0) > 0
                ? ` · ${lesson.schemeItemIds!.length} item(s) tagged`
                : ""}
              .
            </p>
            <Link
              href="/teacher/schemes"
              className="mt-2 inline-flex text-xs font-medium text-emerald-200/90 underline-offset-4 hover:underline"
            >
              Open schemes
            </Link>
          </div>
        </div>
      ) : null}

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-white">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-white/80">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canWrite}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80 flex items-center gap-1">
                <CalendarDays className="h-4 w-4 opacity-60" />
                Scheduled date
              </Label>
              <CustomDatePicker
                value={scheduled}
                onChange={setScheduled}
                placeholder="Optional"
                disabled={!canWrite}
                triggerAriaLabel="Scheduled lesson date"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Status</Label>
              <PremiumSelect
                value={status}
                disabled={!canWrite}
                onValueChange={(v) => void handleStatusChange(v as LessonDeliveryStatus)}
              >
                <PremiumSelectTrigger className="w-full">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="draft">{LESSON_STATUS_LABELS.draft}</PremiumSelectItem>
                  <PremiumSelectItem value="published">
                    {LESSON_STATUS_LABELS.published}
                  </PremiumSelectItem>
                  <PremiumSelectItem value="archived">
                    {LESSON_STATUS_LABELS.archived}
                  </PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            {(lesson.status === "published" || lesson.status === "archived") &&
              lesson.studentCompletionSnapshot && (
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/75">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/90" />
                    <div>
                      <p className="font-medium text-white">Student “studied” reports</p>
                      <p className="mt-0.5 text-white/65">
                        {lesson.studentCompletionSnapshot.studiedCount} of{" "}
                        {lesson.studentCompletionSnapshot.classActiveStudentsTotal} active learners in
                        this class
                        {lesson.studentCompletionSnapshot.studiedPercent != null && (
                          <span className="text-white/50">
                            {" "}
                            ({lesson.studentCompletionSnapshot.studiedPercent}%)
                          </span>
                        )}
                        . Based on self-reported completion in the student portal.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            {lesson.linkedAssignmentsSummary && (
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/75">
                  <Presentation className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/90" />
                  <div>
                    <p className="font-medium text-white">Lesson tasks created</p>
                    <p className="mt-0.5 text-white/65">
                      {lesson.linkedAssignmentsSummary.total} linked tasks ·{" "}
                      {lesson.linkedAssignmentsSummary.quizCount} quizzes ·{" "}
                      {lesson.linkedAssignmentsSummary.assignmentCount} assignments/projects/practice ·{" "}
                      {lesson.linkedAssignmentsSummary.published} published
                      {lesson.linkedAssignmentsSummary.draft > 0 && (
                        <span className="text-white/45">
                          {" "}
                          ({lesson.linkedAssignmentsSummary.draft} drafts)
                        </span>
                      )}
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {canWrite && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void saveBasics()}
                disabled={updateMutation.isPending}
                className="bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
              >
                Save changes
              </Button>
            </div>
          )}
          {!canWrite && (
            <p className="text-sm text-white/50">You have view-only access for this school.</p>
          )}
        </CardContent>
      </Card>

      {lesson.status === "published" && lesson.publishedSnapshot != null && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
          Students see a frozen copy of your lesson note from when you published. Change the note
          and publish again to update what they see.
        </div>
      )}

      {lesson.status === "published" && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/65">
          {lesson.parentSummaryVisibleToParents ? (
            <>
              Parents can view <span className="text-white/85">family summaries</span> you save on
              this lesson (Leo → Parent summary → Save to lesson).
            </>
          ) : (
            <>
              Parent-facing lesson summaries are{" "}
              <span className="text-white/85">disabled school-wide</span>. An admin can enable them
              under Settings → Features.
            </>
          )}
        </div>
      )}

      <TeacherLessonLeoPanel
        lessonId={lesson.id}
        lessonNoteId={lesson.lessonNoteId}
        canWrite={canWrite}
      />

      <TeacherLessonResourcesPanel
        lessonId={lesson.id}
        canWrite={canWrite}
        lessonStatus={lesson.status}
      />

      <TeacherLessonFlashcardsPanel
        lessonId={lesson.id}
        canWrite={canWrite}
        lessonStatus={lesson.status}
      />

      <TeacherLessonReflectionPanel lessonId={lesson.id} canWrite={canWrite} />

      <TeacherLessonCollaborationPanel
        lessonId={lesson.id}
        canWrite={canWrite}
        role={lesson.collaboration?.role ?? "owner"}
        collaborators={lesson.collaboration?.collaborators ?? []}
      />

      <TeacherLessonAuditPanel lessonId={lesson.id} canView={canView} />

      {confirmationDialog}
    </div>
  );
}
