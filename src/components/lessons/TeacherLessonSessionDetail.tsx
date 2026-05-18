"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MonitorPlay,
  Save,
} from "lucide-react";
import {
  useCompleteLessonDelivery,
  useLinkLessonAttendance,
} from "@/hooks/teacher/useLessonSessionTeach";
import { LessonContentBlocksEditor } from "@/components/lessons/LessonContentBlocksEditor";
import { useGenerateSessionContent } from "@/hooks/teacher/useLessonsLeo";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
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
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_LABELS,
  type LessonDeliveryStatus,
} from "@/types/lessons-v2";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
};

export function TeacherLessonSessionDetail({ sessionId }: Props) {
  const { data: classesData } = useTeacherClasses();
  const busyToast = useBusyToast();
  const { data, isLoading, error } = useTeacherLessonSession(sessionId);
  const updateSession = useUpdateTeacherLessonSession(sessionId);
  const completeDelivery = useCompleteLessonDelivery();
  const linkAttendance = useLinkLessonAttendance();

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
    setPlanNotes(session.planNotes || "");
    setTitle(session.title);
    setContentBlocks(session.contentBlocks ?? []);
    setDirty(false);
  }, [session]);

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
    await busyToast.promise(completeDelivery.mutateAsync(deliveryId), {
      loading: "Completing lesson…",
      success: (res) => {
        const count = res?.data?.coverageRecordsWritten ?? 0;
        return count > 0
          ? `Completed · ${count} scheme item${count === 1 ? "" : "s"} covered`
          : "Lesson marked complete";
      },
      error: (e) => (e instanceof Error ? e.message : "Failed to complete"),
    });
  };

  const linkAttendancePhase = async (phase: "before" | "after") => {
    if (!deliveryId || !session) return;
    await busyToast.promise(
      linkAttendance.mutateAsync({
        deliveryId,
        phase,
        periodNumber: session.sequenceInWeek,
      }),
      {
        loading: "Linking attendance…",
        success: `${phase === "before" ? "Before" : "After"} attendance linked`,
        error: (e) => (e instanceof Error ? e.message : "Failed to link attendance"),
      },
    );
  };

  const generateWithLeo = async () => {
    if (!session) return;
    const blocks = await busyToast.promise(
      generateContent.mutateAsync({
        lessonNoteId: session.lessonNoteId,
        session: {
          title: session.title,
          durationMinutes: session.durationMinutes,
          noteSectionKeys: session.noteSectionAllocation.noteSectionKeys,
          coverageWeight: session.noteSectionAllocation.coverageWeight,
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

  const showPostLesson =
    deliveryStatus === "delivered" ||
    deliveryStatus === "completed" ||
    deliveryStatus === "in_progress";

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
          classGroupId={session.classGroupId}
        />
      ) : null}

      <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-white">Delivery</CardTitle>
          <p className="text-xs text-white/50">
            Teach in presenter mode, then mark delivered and complete when finished.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {teachingEnabled ? (
            <Button
              type="button"
              asChild
              className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
            >
              <Link href={`/teacher/lessons/sessions/${sessionId}/teach`}>
                <MonitorPlay className="mr-2 h-4 w-4" />
                {deliveryStatus === "in_progress" ? "Resume teaching" : "Teach"}
              </Link>
            </Button>
          ) : null}
          {deliveryStatus === "delivered" ? (
            <Button
              type="button"
              onClick={() => void markComplete()}
              disabled={completeDelivery.isPending || !deliveryId}
              className="bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark complete
            </Button>
          ) : null}
          {deliveryStatus === "completed" ? (
            <p className="text-sm text-emerald-200/90">This session is complete for this class.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-white">Attendance</CardTitle>
          <p className="text-xs text-white/50">
            Link period attendance to this delivery, or open the attendance grid to record marks.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void linkAttendancePhase("before")}
            disabled={linkAttendance.isPending || !deliveryId}
            className="border-white/10 bg-white/5 text-white/75"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Link before attendance
            {session.delivery?.attendanceBeforeId ? " ✓" : ""}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void linkAttendancePhase("after")}
            disabled={linkAttendance.isPending || !deliveryId}
            className="border-white/10 bg-white/5 text-white/75"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Link after attendance
            {session.delivery?.attendanceAfterId ? " ✓" : ""}
          </Button>
          <Button type="button" variant="outline" asChild className="border-white/10 bg-white/5 text-white/75">
            <Link
              href={`/teacher/attendance/period?classGroupId=${session.classGroupId}&date=${session.scheduledDate}`}
            >
              Open attendance grid
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-white">Visibility</CardTitle>
          <p className="text-xs text-white/50">
            Control who can see this session in student, parent, and admin surfaces.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {requireAiReview && session.unreviewedAiBlockCount > 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Review {session.unreviewedAiBlockCount} AI-generated block
                {session.unreviewedAiBlockCount === 1 ? "" : "s"} before publishing to students.
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
                <p className="text-xs text-white/45">Visible to parents when your school enables it.</p>
              </div>
              <Switch
                checked={session.parentVisibility}
                onCheckedChange={(checked) => void patchVisibility({ parentVisibility: checked })}
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
                onCheckedChange={(checked) => void patchVisibility({ adminVisibility: checked })}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-white">Lesson content</CardTitle>
          <p className="text-xs text-white/50">
            Rich blocks shown to students when published. Leo drafts require your review when your
            school has that setting enabled.
          </p>
        </CardHeader>
        <CardContent>
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
            />
          ) : (
            <p className="text-sm text-white/55">
              You are covering this session as a substitute. Content editing stays with the session
              owner.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg text-white">Session plan notes</CardTitle>
          <p className="text-xs text-white/50">Private teacher notes for this period (not shown to students).</p>
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
              placeholder="Objectives, activities, materials, and reminders for this period…"
              className="min-h-[200px] border-white/10 bg-white/5 text-white"
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
            Save changes
          </Button>
        </CardContent>
      </Card>

      {showPostLesson && reflectionEnabled ? (
        <TeacherSessionReflectionPanel sessionId={sessionId} canWrite />
      ) : null}

      {resourcesEnabled && canManageContent ? (
        <TeacherSessionResourcesPanel
          sessionId={sessionId}
          canWrite={canManageContent}
          studentPublished={session?.studentVisibility === "published"}
        />
      ) : null}

      {deliveryStatus === "completed" && flashcardsEnabled && canManageContent ? (
        <TeacherSessionFlashcardsPanel
          sessionId={sessionId}
          canWrite={canManageContent}
          leoEnabled={leoEnabled}
          studentPublished={session.studentVisibility === "published"}
        />
      ) : null}

      {deliveryStatus === "completed" && canManageContent ? (
        <TeacherSessionAssignmentsPanel
          sessionId={sessionId}
          canWrite={canManageContent}
          leoEnabled={leoEnabled}
        />
      ) : null}
    </div>
  );
}
