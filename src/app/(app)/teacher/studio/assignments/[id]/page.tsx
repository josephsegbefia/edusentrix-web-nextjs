"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileText,
  FolderKanban,
  Layers3,
  Send,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { useTeacherAssignment } from "@/hooks/teacher/useTeacherAssignment";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { AssignmentBuilder, type AssignmentFormValues, type AssignmentAttachment } from "@/components/teacher/studio/AssignmentBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

const statusStyles: Record<string, string> = {
  draft: "border border-white/10 bg-white/10 text-white/70",
  published: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  closed: "border border-amber-500/40 bg-amber-500/15 text-amber-200",
  archived: "border border-rose-500/40 bg-rose-500/15 text-rose-200",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
  archived: "Archived",
};

function latePolicyLabel(policy: string, penaltyPercent: number | null | undefined) {
  if (policy === "reject") return "Reject late work";
  if (policy === "penalize") {
    return `Late penalty ${penaltyPercent ?? 0}%`;
  }
  return "Accept late work";
}

export default function TeacherAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const busyToast = useBusyToast();
  const assignmentId = params?.id as string | undefined;
  const editMode = searchParams.get("edit") === "1";

  const { data, isLoading, refetch } = useTeacherAssignment(assignmentId);
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.assignmentsCreate);
  const canPublish = can(permissions, PERMISSIONS.assignmentsPublish);
  const assignment = data?.data.assignment;
  const questionList = assignment?.questions || [];
  const totalQuestionPoints = questionList.reduce(
    (sum, question) => sum + (question.points || 0),
    0
  );

  const initialValues = React.useMemo<Partial<AssignmentFormValues> | undefined>(() => {
    if (!assignment) return undefined;
    return {
      title: assignment.title,
      instructions: assignment.instructions,
      type: assignment.type,
      subjectId: assignment.subject?.id || "",
      classGroupIds: assignment.classGroups.map((group) => group.id),
      dueDate: assignment.dueDate ? new Date(assignment.dueDate) : new Date(),
      latePolicy: assignment.latePolicy,
      latePenaltyPercent: assignment.latePenaltyPercent ?? null,
      maxScore: assignment.maxScore,
      weight: assignment.weight ?? null,
      rubricId: assignment.rubric?.id || null,
      attachments: assignment.attachments as AssignmentAttachment[],
      questions: assignment.questions || [],
    };
  }, [assignment]);

  const handlePublish = async () => {
    if (!assignmentId) return;
    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${assignmentId}/publish`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to publish assignment");
        }
        return res.json();
      }),
      {
        loading: "Publishing assignment...",
        success: "Assignment published",
        error: "Failed to publish assignment",
      }
    );
    await refetch();
  };

  const handleClose = async () => {
    if (!assignmentId) return;
    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${assignmentId}/close`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error || "Failed to close assignment");
        }
        return res.json();
      }),
      {
        loading: "Closing assignment...",
        success: "Assignment closed",
        error: "Failed to close assignment",
      }
    );
    await refetch();
  };

  const handleUpdate = async (values: AssignmentFormValues, options?: { publish?: boolean }) => {
    if (!assignmentId) return;
    if (!values.subjectId || values.classGroupIds.length === 0) {
      busyToast.warning("Select a subject and at least one class.");
      return;
    }
    if (!values.dueDate) {
      busyToast.warning("Select a due date.");
      return;
    }

    const payload = {
      title: values.title,
      instructions: values.instructions,
      type: values.type,
      subjectId: values.subjectId,
      classGroupIds: values.classGroupIds,
      dueDate: values.dueDate.toISOString(),
      latePolicy: values.latePolicy,
      latePenaltyPercent: values.latePenaltyPercent ?? undefined,
      maxScore: values.maxScore,
      weight: values.weight ?? undefined,
      rubricId: values.rubricId ?? null,
      attachments: values.attachments,
      questions: values.questions,
    };

    await busyToast.promise(
      fetch(`/api/teacher/studio/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to update assignment");
        return data;
      }),
      {
        loading: "Updating assignment...",
        success: "Assignment updated",
        error: "Failed to update assignment",
      }
    );

    if (options?.publish && assignment?.status === "draft") {
      await handlePublish();
    }

    router.push(`/teacher/studio/assignments/${assignmentId}`);
    await refetch();
  };

  if (isLoading || !assignment) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (assignment.type === "quiz") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        This item is a quiz and is now managed in the Quizzes section.
        <div className="mt-4">
          <Button asChild variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
            <Link href={`/teacher/studio/quizzes/${assignmentId || ""}`}>
              Open quiz page
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (editMode && !canCreate) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
        You do not have permission to edit assignments.
        <div className="mt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/teacher/studio/assignments/${assignmentId}`)}
            className="text-white/60 hover:bg-white/10 hover:text-white"
          >
            Back to assignment
          </Button>
        </div>
      </div>
    );
  }

  if (editMode) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="outline"
            className="w-fit border-white/10 bg-white/5 text-white/70 shadow-lg shadow-black/20 hover:bg-white/10"
          >
            <Link href={`/teacher/studio/assignments/${assignmentId}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to assignment
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-white">Edit Assignment</h1>
            <p className="text-sm text-white/60">
              Update details for {assignment.title} with the guided step workflow.
            </p>
          </div>
        </div>
        <AssignmentBuilder
          key={`edit-${assignmentId || "assignment"}-${
            assignment.questionCount ?? assignment.questions?.length ?? 0
          }`}
          mode="edit"
          initialValues={initialValues}
          onSubmit={handleUpdate}
          showPublish={assignment.status === "draft" && canPublish}
          layout="wizard"
          allowedTypes={["assignment", "project", "practice"]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="outline"
        className="border-white/10 bg-white/5 text-white/70 shadow-lg shadow-black/20 hover:bg-white/10"
      >
        <Link href="/teacher/studio/assignments">
          <ArrowLeft className="h-4 w-4" />
          Back to assignments
        </Link>
      </Button>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/85 via-slate-950/85 to-black/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-52 w-52 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={cn(statusStyles[assignment.status] || statusStyles.draft)}>
                  {statusLabel[assignment.status] || "Draft"}
                </Badge>
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                  {assignment.subject?.name || "Subject"}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {assignment.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/65">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-white/40" />
                  {assignment.dueDate
                    ? new Date(assignment.dueDate).toLocaleString()
                    : "No due date"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-white/40" />
                  {assignment.type}
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              Premium assignment overview
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-indigo-100/70">
                Pending
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {assignment.stats.pending}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">
                Graded
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {assignment.stats.graded}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Questions
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {questionList.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                Max score
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {assignment.maxScore}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {canCreate && (
              <Button asChild className="bg-white/10 text-white hover:bg-white/20">
                <Link href={`/teacher/studio/assignments/${assignmentId}?edit=1`}>
                  <Edit3 className="h-4 w-4" />
                  Edit assignment
                </Link>
              </Button>
            )}
            <Button asChild className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
              <Link href={`/teacher/studio/assignments/${assignmentId}/submissions`}>
                <FolderKanban className="h-4 w-4" />
                View submissions
              </Link>
            </Button>
            {assignment.status === "draft" && canPublish && (
              <Button onClick={handlePublish} className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
                <Send className="h-4 w-4" />
                Publish
              </Button>
            )}
            {assignment.status === "published" && canPublish && (
              <Button onClick={handleClose} className="bg-amber-500/20 text-amber-100 hover:bg-amber-500/30">
                <XCircle className="h-4 w-4" />
                Close submissions
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-lg">
                <BookOpenText className="h-5 w-5 text-white/60" />
                Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-white/75 whitespace-pre-wrap">
              {assignment.instructions}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5 text-white/60" />
                Question Blueprint
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {questionList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-white/55">
                  No auto-graded questions added for this assignment.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Total Questions
                      </p>
                      <p className="mt-1.5 text-lg font-semibold text-white">
                        {questionList.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Question Points
                      </p>
                      <p className="mt-1.5 text-lg font-semibold text-white">
                        {totalQuestionPoints}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Avg Choices
                      </p>
                      <p className="mt-1.5 text-lg font-semibold text-white">
                        {Math.round(
                          questionList.reduce(
                            (sum, question) => sum + (question.choices?.length || 0),
                            0
                          ) / questionList.length
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {questionList.slice(0, 4).map((question, index) => (
                      <div
                        key={question.id || index}
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="line-clamp-1 text-sm text-white/80">
                            {index + 1}. {question.prompt}
                          </p>
                          <span className="text-xs text-white/50">
                            {question.points} pt
                          </span>
                        </div>
                      </div>
                    ))}
                    {questionList.length > 4 && (
                      <p className="text-xs text-white/45">
                        +{questionList.length - 4} more questions
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-white/60" />
                Performance Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-indigo-100/70">
                  Pending
                </p>
                <p className="mt-1.5 text-lg font-semibold text-white">
                  {assignment.stats.pending}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">
                  Graded
                </p>
                <p className="mt-1.5 text-lg font-semibold text-white">
                  {assignment.stats.graded}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Total
                </p>
                <p className="mt-1.5 text-lg font-semibold text-white">
                  {assignment.stats.total}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Returned
                </p>
                <p className="mt-1.5 text-lg font-semibold text-white">
                  {assignment.stats.returned}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-lg">
                <Layers3 className="h-5 w-5 text-white/60" />
                Assignment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/75">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                  Classes
                </p>
                <p className="mt-1.5">
                  {assignment.classGroups.map((group) => group.name).join(", ")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Max Score
                  </p>
                  <p className="mt-1.5 font-semibold text-white">
                    {assignment.maxScore}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Weight
                  </p>
                  <p className="mt-1.5 font-semibold text-white">
                    {assignment.weight ?? 0}%
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Late Policy
                  </p>
                  <p className="mt-1.5 text-white/85">
                    {latePolicyLabel(
                      assignment.latePolicy,
                      assignment.latePenaltyPercent
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Rubric
                  </p>
                  <p className="mt-1.5 text-white/85">
                    {assignment.rubric?.title || "No rubric linked"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-white/60" />
                Resources & Attachments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {assignment.attachments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/55">
                  No attachments for this assignment.
                </div>
              ) : (
                assignment.attachments.map((attachment, index) => (
                  <a
                    key={`${attachment.name}-${index}`}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
                  >
                    {attachment.name}
                  </a>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
