"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ClipboardCheck, Edit3, FolderKanban, Send, XCircle } from "lucide-react";
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Edit Assignment</h1>
            <p className="text-sm text-white/60">Update details for {assignment.title}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/teacher/studio/assignments/${assignmentId}`)}
            className="text-white/60 hover:bg-white/10 hover:text-white"
          >
            Cancel edit
          </Button>
        </div>
        <AssignmentBuilder
          mode="edit"
          initialValues={initialValues}
          onSubmit={handleUpdate}
          showPublish={assignment.status === "draft" && canPublish}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={cn(statusStyles[assignment.status] || statusStyles.draft)}>
            {assignment.status}
          </Badge>
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">
            {assignment.subject?.name || "Subject"}
          </span>
        </div>
        <h1 className="text-3xl font-semibold text-white">{assignment.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-white/40" />
            {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "No due date"}
          </span>
          <span className="inline-flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-white/40" />
            {assignment.stats.pending} pending
          </span>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-white/70 whitespace-pre-wrap">
            {assignment.instructions}
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/40">Classes</div>
              <div className="mt-1">
                {assignment.classGroups.map((group) => group.name).join(", ")}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/40">Max score</div>
              <div className="mt-1">{assignment.maxScore}</div>
            </div>
            {assignment.rubric && (
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">Rubric</div>
                <div className="mt-1">{assignment.rubric.title}</div>
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/40">Attachments</div>
              <div className="mt-2 space-y-2">
                {assignment.attachments.length === 0 ? (
                  <div className="text-white/50">No attachments</div>
                ) : (
                  assignment.attachments.map((attachment, index) => (
                    <a
                      key={`${attachment.name}-${index}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                    >
                      {attachment.name}
                    </a>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
