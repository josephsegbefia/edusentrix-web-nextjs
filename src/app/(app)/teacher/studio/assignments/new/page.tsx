"use client";

import { useRouter } from "next/navigation";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { AssignmentBuilder, type AssignmentFormValues } from "@/components/teacher/studio/AssignmentBuilder";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherAssignmentCreatePage() {
  const router = useRouter();
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.assignmentsCreate);
  const canPublish = can(permissions, PERMISSIONS.assignmentsPublish);

  if (!canCreate) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
        You do not have permission to create assignments.
      </div>
    );
  }

  const handleSubmit = async (values: AssignmentFormValues, options?: { publish?: boolean }) => {
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
      rubricId: values.rubricId ?? undefined,
      attachments: values.attachments,
      status: options?.publish ? "published" : "draft",
    };

    const result = await busyToast.promise(
      fetch("/api/teacher/studio/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to create assignment");
        return data;
      }),
      {
        loading: "Saving assignment...",
        success: options?.publish ? "Assignment published" : "Assignment saved",
        error: "Failed to save assignment",
      }
    );

    const assignmentId = result?.data?.assignment?.id;
    if (assignmentId) {
      router.push(`/teacher/studio/assignments/${assignmentId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Create Assignment</h1>
        <p className="text-sm text-white/60">
          Build a new assignment and publish when you are ready.
        </p>
      </div>
      <AssignmentBuilder onSubmit={handleSubmit} showPublish={canPublish} />
    </div>
  );
}
