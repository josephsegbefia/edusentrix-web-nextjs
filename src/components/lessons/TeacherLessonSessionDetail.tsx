"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Globe,
  Lock,
  Loader2,
  Eye,
  MonitorPlay,
  NotebookPen,
  Save,
  Trash2,
} from "lucide-react";
import { SessionBoardNotesPanel } from "@/components/lessons/SessionBoardNotesPanel";
import { useCompleteLessonDelivery } from "@/hooks/teacher/useLessonSessionTeach";
import { LessonContentBlocksEditor } from "@/components/lessons/LessonContentBlocksEditor";
import { LessonQualityStrip } from "@/components/lessons/LessonQualityStrip";
import { useGenerateSessionContent } from "@/hooks/teacher/useLessonsLeo";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TeacherSessionSubstituteCard } from "@/components/lessons/TeacherSessionSubstituteCard";
import { TeacherSessionReflectionPanel } from "@/components/lessons/TeacherSessionReflectionPanel";
import { TeacherSessionFlashcardsPanel } from "@/components/lessons/TeacherSessionFlashcardsPanel";
import { TeacherSessionAssignmentsPanel } from "@/components/lessons/TeacherSessionAssignmentsPanel";
import { TeacherSessionResourcesPanel } from "@/components/lessons/TeacherSessionResourcesPanel";
import { TeacherSessionAssessmentPanel } from "@/components/lessons/TeacherSessionAssessmentPanel";
import { TeacherSessionLearnResourcesPanel } from "@/components/lessons/TeacherSessionLearnResourcesPanel";
import { TeacherSessionExplorePanel } from "@/components/lessons/TeacherSessionExplorePanel";
import { TeachAttendanceModal } from "@/components/lessons/TeachAttendanceModal";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useTeacherLessonSession,
  useUpdateTeacherLessonSession,
} from "@/hooks/teacher/useTeacherLessonSession";
import { useSessionDeleteImpact, useDeleteLessonSession } from "@/hooks/teacher/useDeleteLessonSession";
import { useBusyToast } from "@/hooks/useBusyToast";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import {
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_LABELS,
  type LessonDeliveryStatus,
} from "@/types/lessons-v2";
import { cn } from "@/lib/utils";
import { LessonWeekPreviewPresenter } from "@/components/lessons/LessonWeekPreviewPresenter";
import { LessonContentBlocksRenderer } from "@/components/lessons/LessonContentBlocksRenderer";
import {
  AfterClassStepHeading,
  TeacherSessionAfterClassWorkflow,
} from "@/components/lessons/TeacherSessionAfterClassWorkflow";
import { TeacherSessionTaughtArchive } from "@/components/lessons/TeacherSessionTaughtArchive";

type Props = {
  sessionId: string;
};

export function TeacherLessonSessionDetail({ sessionId }: Props) {
  const router = useRouter();
  const { data: classesData } = useTeacherClasses();
  const { data: teacherContext } = useTeacherContext();
  const schoolId = teacherContext?.data?.school?._id;
  const busyToast = useBusyToast();
  const [activeClassGroupId, setActiveClassGroupId] = React.useState<string | null>(null);
  const { data, isLoading, error } = useTeacherLessonSession(sessionId, activeClassGroupId);
  const updateSession = useUpdateTeacherLessonSession(sessionId, activeClassGroupId);
  const completeDelivery = useCompleteLessonDelivery();
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showPreAttendanceModal, setShowPreAttendanceModal] = React.useState(false);
  const [showSessionPreview, setShowSessionPreview] = React.useState(false);
  const [notebookNotes, setNotebookNotes] = React.useState<{
    contentHtml: string;
    generatedAt: string | Date;
    aiGenerated: boolean;
  } | null>(null);
  const [notebookNotesPublished, setNotebookNotesPublished] = React.useState(false);
  const impactQuery = useSessionDeleteImpact(sessionId, showDeleteModal);
  const deleteSession = useDeleteLessonSession(sessionId);

  const session = data?.data.session;
  const classLabel = React.useMemo(() => {
    if (!session?.classGroupId) return "Class";
    const match = classesData?.data.classes.find((c) => c._id === session.classGroupId);
    if (!match) return "Class";
    return `${match.gradeName ? `${match.gradeName} ` : ""}${match.name}`.trim();
  }, [classesData, session?.classGroupId]);
  const [planNotes, setPlanNotes] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [contentBlocks, setContentBlocks] = React.useState<LessonContentBlock[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const generateContent = useGenerateSessionContent();

  const lessonsSettings = data?.data.lessonsSettings;
  const access = data?.data.access;
  const canManageContent = access?.canManageContent ?? true;
  const isSubstitute = access?.isSubstitute ?? false;
  const leoEnabled = lessonsSettings?.enableLeoLessonTools ?? false;
  const requireAiReview = lessonsSettings?.requireTeacherReviewForAiContent ?? true;
  const teachingEnabled = lessonsSettings?.enableTeachingMode ?? false;
  const flashcardsEnabled = lessonsSettings?.enableFlashcards ?? false;
  const resourcesEnabled = lessonsSettings?.enableResources ?? false;
  const reflectionEnabled = lessonsSettings?.enableLessonReflection ?? false;
  const parentSummaryEnabled = lessonsSettings?.parentSummaryVisibleToParents ?? false;

  React.useEffect(() => {
    if (!session) return;
    if (!activeClassGroupId && session.activeClassGroupId) {
      setActiveClassGroupId(session.activeClassGroupId);
    }
    setPlanNotes(session.planNotes || "");
    setTitle(session.title);
    setContentBlocks(session.contentBlocks ?? []);
    setDirty(false);
  }, [session, activeClassGroupId]);

  React.useEffect(() => {
    if (!sessionId) return;
    void fetch(`/api/teacher/lesson-sessions/${sessionId}/board-notes`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.data) {
          setNotebookNotes(json.data.boardNotes ?? null);
          setNotebookNotesPublished(Boolean(json.data.notebookNotesPublished));
        }
      })
      .catch(() => null);
  }, [sessionId]);

  const deliveryStatus = session?.delivery?.status ?? "scheduled";
  const deliveryId = session?.delivery?.id;

  const saveContent = async () => {
    await busyToast.promise(
      updateSession.mutateAsync({
        title: title.trim() || undefined,
        planNotes: planNotes.trim() || null,
        contentBlocks,
      }),
      {
        loading: "Saving session…",
        success: "Session saved",
        error: (e) => (e instanceof Error ? e.message : "Failed to save"),
      },
    );
    setDirty(false);
  };

  const markComplete = async () => {
    if (!deliveryId) return;
    busyToast.show("Completing lesson…");
    try {
      const res = await completeDelivery.mutateAsync(deliveryId);
      const count = res?.data?.coverageRecordsWritten ?? 0;
      busyToast.hide();
      busyToast.success(
        count > 0
          ? `Completed · ${count} scheme item${count === 1 ? "" : "s"} covered`
          : "Lesson marked complete",
      );
    } catch (e) {
      busyToast.hide();
      busyToast.error(e instanceof Error ? e.message : "Failed to complete");
    }
  };

  const generateWithLeo = async () => {
    if (!session) return;
    const blocks = await busyToast.promise(
      generateContent.mutateAsync({
        lessonNoteId: session.lessonNoteId,
        sessionId: session.id,
        session: {
          title: session.title,
          durationMinutes: session.durationMinutes,
          noteSectionKeys: session.noteSectionAllocation.noteSectionKeys,
          coverageWeight: session.noteSectionAllocation.coverageWeight,
          sequenceInWeek: session.sequenceInWeek,
        },
      }),
      {
        loading: "Leo is drafting content…",
        success: "Content blocks generated",
        error: (e) => (e instanceof Error ? e.message : "Generation failed"),
      },
    );
    setContentBlocks(blocks);
    setDirty(true);
  };

  const patchVisibility = async (patch: {
    studentVisibility?: "hidden" | "published";
    parentVisibility?: boolean;
    adminVisibility?: boolean;
  }) => {
    await busyToast.promise(updateSession.mutateAsync({ ...patch, contentBlocks }), {
      loading: "Updating visibility…",
      success: "Visibility updated",
      error: (e) => (e instanceof Error ? e.message : "Failed to update visibility"),
    });
  };

  const isActiveClassTaught =
    deliveryStatus === "in_progress" ||
    deliveryStatus === "delivered" ||
    deliveryStatus === "completed";

  const followUpUnlocked =
    deliveryStatus === "completed" || deliveryStatus === "delivered";

  if (error) {
    return (
      <Card className="border border-rose-500/20 bg-rose-500/10">
        <CardContent className="p-5 text-sm text-rose-100">{error.message}</CardContent>
      </Card>
    );
  }

  if (isLoading || !session) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{session.title}</h1>
          <p className="mt-1 text-sm text-white/60">
            {classLabel || "Class"} · {session.scheduledDate} · {session.startTime}–
            {session.endTime}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageContent && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            asChild
            className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
          >
            <Link href="/teacher/lessons">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to lessons
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn("border-0", DELIVERY_STATUS_COLORS[deliveryStatus])}>
          {DELIVERY_STATUS_LABELS[deliveryStatus]}
        </Badge>
        <Badge
          className={cn(
            "border-0",
            session.studentVisibility === "published"
              ? "bg-emerald-500/20 text-emerald-200"
              : "bg-slate-500/20 text-slate-200",
          )}
        >
          {session.studentVisibility === "published" ? "Student visible" : "Hidden"}
        </Badge>
        {isSubstitute ? (
          <Badge className="border-0 bg-sky-500/20 text-sky-200">Substitute</Badge>
        ) : null}
      </div>

      {canManageContent ? (
        <TeacherSessionSubstituteCard
          sessionId={sessionId}
          session={session}
          classGroupId={session.activeClassGroupId}
        />
      ) : null}

      {(session.classDeliveries?.length ?? 0) > 1 ? (
        <Card className="border border-violet-400/20 bg-violet-500/8 shadow-lg shadow-black/20 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-violet-100">Teaching class</CardTitle>
            <p className="text-xs text-white/50">
              Same lesson content — pick which class you are delivering or reviewing.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(session.classDeliveries ?? []).map((delivery) => {
              const match = classesData?.data.classes.find(
                (c) => c._id === delivery.classGroupId,
              );
              const label = match
                ? `${match.gradeName ? `${match.gradeName} ` : ""}${match.name}`
                : "Class";
              const active = delivery.classGroupId === session.activeClassGroupId;
              return (
                <Button
                  key={delivery.id}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setActiveClassGroupId(delivery.classGroupId)}
                  className={
                    active
                      ? "bg-violet-500/25 text-violet-100"
                      : "border-white/10 bg-white/5 text-white/70"
                  }
                >
                  {label}
                  <span className="ml-2 text-[10px] uppercase opacity-70">
                    {delivery.status.replace("_", " ")}
                  </span>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-white">
            {isActiveClassTaught ? "Teaching" : "Before class"}
          </CardTitle>
          <p className="text-xs text-white/50">
            {isActiveClassTaught
              ? "Resume presenter mode or preview what you taught."
              : "Preview your lesson, then teach in presenter mode."}
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowSessionPreview(true)}
            className="border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          {teachingEnabled ? (
            deliveryStatus === "in_progress" ? (
              <Button
                type="button"
                asChild
                className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
              >
                <Link
                  href={`/teacher/lessons/sessions/${sessionId}/teach${
                    session.activeClassGroupId
                      ? `?classGroupId=${encodeURIComponent(session.activeClassGroupId)}`
                      : ""
                  }`}
                >
                  <MonitorPlay className="mr-2 h-4 w-4" />
                  Resume teaching
                </Link>
              </Button>
            ) : deliveryStatus === "scheduled" || deliveryStatus === "cancelled" ? (
              <Button
                type="button"
                onClick={() => setShowPreAttendanceModal(true)}
                className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
              >
                <MonitorPlay className="mr-2 h-4 w-4" />
                Teach
              </Button>
            ) : null
          ) : null}
          {deliveryStatus === "completed" ? (
            <p className="self-center text-sm text-emerald-200/90">
              Complete for {classLabel || "this class"}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isActiveClassTaught ? (
        <>
          <TeacherSessionAfterClassWorkflow
            deliveryStatus={deliveryStatus}
            classLabel={classLabel || "this class"}
            showReflectStep={reflectionEnabled}
            notebook={
              <>
                <AfterClassStepHeading
                  title="Notes for students' notebooks"
                  description="Structured revision notes for the board and for students to copy."
                  icon={NotebookPen}
                />
                <SessionBoardNotesPanel
                  sessionId={sessionId}
                  initialNotes={notebookNotes}
                  notebookNotesPublished={notebookNotesPublished}
                  canWrite={canManageContent}
                  leoEnabled={leoEnabled}
                  onSaved={(saved, published) => {
                    setNotebookNotes(saved);
                    setNotebookNotesPublished(published);
                  }}
                />
              </>
            }
            wrapUp={
              <>
                <AfterClassStepHeading
                  title="Wrap up this class"
                  description="Confirm attendance and mark the delivery complete when you are done."
                  icon={CheckCircle2}
                />
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs",
                        session.delivery?.attendanceBeforeId
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/5 text-white/40",
                      )}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Pre-lesson {session.delivery?.attendanceBeforeId ? "recorded" : "not yet"}
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs",
                        session.delivery?.attendanceAfterId
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/5 text-white/40",
                      )}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Post-lesson {session.delivery?.attendanceAfterId ? "recorded" : "not yet"}
                    </div>
                  </div>
                  {deliveryStatus === "delivered" ? (
                    <Button
                      type="button"
                      onClick={() => void markComplete()}
                      disabled={completeDelivery.isPending || !deliveryId}
                      className="bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark complete for {classLabel || "this class"}
                    </Button>
                  ) : deliveryStatus === "completed" ? (
                    <p className="text-sm text-emerald-200/90">
                      This delivery is complete. Continue with sharing and follow-up below.
                    </p>
                  ) : (
                    <p className="text-sm text-white/55">
                      Finish teaching in presenter mode, then return here to mark complete.
                    </p>
                  )}
                </div>
              </>
            }
            share={
              <>
                <AfterClassStepHeading
                  title="Share with students and families"
                  description="Publish the session when content is reviewed and ready."
                  icon={Globe}
                />
                <div className="space-y-3">
                  <LessonQualityStrip
                    blocks={contentBlocks}
                    requireTeacherReviewForAiContent={requireAiReview}
                  />
                  {requireAiReview && session.unreviewedAiBlockCount > 0 ? (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Review {session.unreviewedAiBlockCount} AI-generated block
                        {session.unreviewedAiBlockCount === 1 ? "" : "s"} before publishing.
                      </p>
                    </div>
                  ) : null}
                  <PremiumSelect
                    value={session.studentVisibility}
                    onValueChange={(v) =>
                      void patchVisibility({ studentVisibility: v as "hidden" | "published" })
                    }
                    disabled={!canManageContent}
                  >
                    <PremiumSelectTrigger>
                      <PremiumSelectValue />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      <PremiumSelectItem value="hidden">Hidden</PremiumSelectItem>
                      <PremiumSelectItem value="published">Published to students</PremiumSelectItem>
                    </PremiumSelectContent>
                  </PremiumSelect>
                  {canManageContent && parentSummaryEnabled ? (
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div>
                        <Label className="text-white/80">Parent summary</Label>
                        <p className="text-xs text-white/45">
                          Visible to parents when your school enables it.
                        </p>
                      </div>
                      <Switch
                        checked={session.parentVisibility}
                        onCheckedChange={(checked) =>
                          void patchVisibility({ parentVisibility: checked })
                        }
                      />
                    </div>
                  ) : null}
                  {canManageContent ? (
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div>
                        <Label className="text-white/80">Admin visibility</Label>
                        <p className="text-xs text-white/45">Include in school admin lesson views.</p>
                      </div>
                      <Switch
                        checked={session.adminVisibility}
                        onCheckedChange={(checked) =>
                          void patchVisibility({ adminVisibility: checked })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </>
            }
            reflect={
              reflectionEnabled ? (
                <TeacherSessionReflectionPanel sessionId={sessionId} canWrite={canManageContent} />
              ) : undefined
            }
            followUp={
              canManageContent && followUpUnlocked ? (
                <div className="space-y-6">
                  <AfterClassStepHeading
                    title="Follow-up for this session"
                    description="Assessment, resources, flashcards, and assignments after you have taught."
                    icon={ClipboardList}
                  />
                  <TeacherSessionAssessmentPanel
                    sessionId={sessionId}
                    initialItems={
                      (session as unknown as {
                        assessmentItems?: import("@/hooks/teacher/useLessonsLeo").LessonAssessmentItem[];
                      }).assessmentItems ?? []
                    }
                    canWrite={canManageContent}
                    leoEnabled={leoEnabled}
                  />
                  {resourcesEnabled ? (
                    <TeacherSessionResourcesPanel
                      sessionId={sessionId}
                      canWrite={canManageContent}
                      studentPublished={session.studentVisibility === "published"}
                    />
                  ) : null}
                  {flashcardsEnabled ? (
                    <TeacherSessionFlashcardsPanel
                      sessionId={sessionId}
                      canWrite={canManageContent}
                      leoEnabled={leoEnabled}
                      studentPublished={session.studentVisibility === "published"}
                    />
                  ) : null}
                  <TeacherSessionLearnResourcesPanel
                    sessionId={sessionId}
                    sessionTitle={title}
                    canWrite={canManageContent}
                    leoEnabled={leoEnabled}
                  />
                  <TeacherSessionExplorePanel
                    sessionId={sessionId}
                    classGroupId={session.activeClassGroupId}
                    canWrite={canManageContent}
                    leoEnabled={leoEnabled}
                  />
                  {deliveryStatus === "completed" ? (
                    <TeacherSessionAssignmentsPanel
                      sessionId={sessionId}
                      canWrite={canManageContent}
                      leoEnabled={leoEnabled}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-white/55">
                  Mark the delivery complete to unlock follow-up tools for this class.
                </p>
              )
            }
          />

          <TeacherSessionTaughtArchive
            classLabel={classLabel || "this class"}
            contentBlocks={contentBlocks}
            title={title}
            planNotes={planNotes}
          />
        </>
      ) : (
        <>
          <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">Lesson content</CardTitle>
              <p className="text-xs text-white/50">
                Prepare blocks for this session. Leo drafts require review before publishing.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <LessonQualityStrip
                blocks={contentBlocks}
                requireTeacherReviewForAiContent={requireAiReview}
              />
              {canManageContent ? (
                <LessonContentBlocksEditor
                  blocks={contentBlocks}
                  onChange={(next) => {
                    setContentBlocks(next);
                    setDirty(true);
                  }}
                  leoEnabled={leoEnabled}
                  leoLoading={generateContent.isPending}
                  onGenerateWithLeo={leoEnabled ? generateWithLeo : undefined}
                  schoolId={schoolId}
                />
              ) : (
                <LessonContentBlocksRenderer blocks={contentBlocks} viewMode="teacher" />
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">Session plan</CardTitle>
              <p className="text-xs text-white/50">
                Private teacher notes for this period (not shown to students).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70">Session title</Label>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  disabled={!canManageContent}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Plan notes</Label>
                <Textarea
                  value={planNotes}
                  onChange={(e) => {
                    setPlanNotes(e.target.value);
                    setDirty(true);
                  }}
                  disabled={!canManageContent}
                  placeholder="Objectives, activities, materials, and reminders for this period…"
                  className="min-h-[160px] border-white/10 bg-white/5 text-white"
                />
              </div>
              <Button
                type="button"
                onClick={() => void saveContent()}
                disabled={!canManageContent || !dirty || updateSession.isPending}
                className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
              >
                {updateSession.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save session
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">Visibility</CardTitle>
              <p className="text-xs text-white/50">
                Optional pre-publish setup. Full sharing controls unlock after you teach.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {requireAiReview && session.unreviewedAiBlockCount > 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Review {session.unreviewedAiBlockCount} AI-generated block
                    {session.unreviewedAiBlockCount === 1 ? "" : "s"} before publishing.
                  </p>
                </div>
              ) : null}
              <PremiumSelect
                value={session.studentVisibility}
                onValueChange={(v) =>
                  void patchVisibility({ studentVisibility: v as "hidden" | "published" })
                }
                disabled={!canManageContent}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="hidden">Hidden</PremiumSelectItem>
                  <PremiumSelectItem value="published">Published to students</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </CardContent>
          </Card>

          {canManageContent ? (
            <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Lock className="h-5 w-5 text-emerald-300/60" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/75">After class unlocks when you teach</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    Notebook notes, wrap-up, sharing, reflection, and follow-up resources appear in a
                    guided flow once this class delivery has started.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Pre-lesson attendance modal */}
      <TeachAttendanceModal
        sessionId={sessionId}
        classGroupId={session?.activeClassGroupId}
        phase="pre"
        open={showPreAttendanceModal}
        onClose={() => setShowPreAttendanceModal(false)}
        onSubmitted={() => {
          setShowPreAttendanceModal(false);
          router.push(
            `/teacher/lessons/sessions/${sessionId}/teach${
              session?.activeClassGroupId
                ? `?classGroupId=${encodeURIComponent(session.activeClassGroupId)}`
                : ""
            }`,
          );
        }}
      />

      {/* Delete session modal */}
      <ResponsiveModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete session"
        description={
          impactQuery.data?.canDelete === false
            ? impactQuery.data.blockReason ?? "This session cannot be deleted."
            : "Review the impact before confirming."
        }
      >
        {impactQuery.isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading impact…
          </div>
        ) : impactQuery.error ? (
          <p className="py-4 text-sm text-rose-300">
            {impactQuery.error instanceof Error
              ? impactQuery.error.message
              : "Failed to load impact."}
          </p>
        ) : impactQuery.data ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 p-4 space-y-2">
              {impactQuery.data.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-2 text-sm text-rose-200/90">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                  {w}
                </p>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowDeleteModal(false)}
                className="text-white/70 hover:text-white"
              >
                Cancel
              </Button>
              {impactQuery.data.canDelete && (
                <Button
                  type="button"
                  disabled={deleteSession.isPending}
                  onClick={() => {
                    deleteSession.mutate(undefined, {
                      onSuccess: () => {
                        setShowDeleteModal(false);
                        router.push("/teacher/lessons");
                      },
                      onError: (err) => {
                        busyToast.error(err.message || "Failed to delete session");
                      },
                    });
                  }}
                  className="bg-rose-600/80 text-white hover:bg-rose-600"
                >
                  {deleteSession.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Delete session permanently
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </ResponsiveModal>

      {showSessionPreview && session ? (
        <LessonWeekPreviewPresenter
          weekTitle={session.title}
          sessions={[
            {
              id: session.id,
              sequenceInWeek: session.sequenceInWeek,
              title: session.title,
              scheduledDate: session.scheduledDate,
              startTime: session.startTime,
              endTime: session.endTime,
              durationMinutes: session.durationMinutes,
              planNotes: session.planNotes,
              contentBlocks: contentBlocks,
              contentVersion: session.contentVersion,
            },
          ]}
          onClose={() => setShowSessionPreview(false)}
        />
      ) : null}
    </div>
  );
}
