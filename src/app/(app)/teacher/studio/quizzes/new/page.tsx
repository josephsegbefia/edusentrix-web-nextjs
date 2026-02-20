"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import {
  AssignmentBuilder,
  type AssignmentFormValues,
} from "@/components/teacher/studio/AssignmentBuilder";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherQuizCreatePage() {
  const router = useRouter();
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.assignmentsCreate);
  const canPublish = can(permissions, PERMISSIONS.assignmentsPublish);

  if (!canCreate) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
        You do not have permission to create quizzes.
      </div>
    );
  }

  const handleSubmit = async (
    values: AssignmentFormValues,
    options?: { publish?: boolean }
  ) => {
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
      type: "quiz" as const,
      subjectId: values.subjectId,
      classGroupIds: values.classGroupIds,
      dueDate: values.dueDate.toISOString(),
      maxScore: values.maxScore,
      quizTimeLimitMinutes: values.quizTimeLimitMinutes ?? null,
      weight: values.weight ?? undefined,
      rubricId: values.rubricId ?? undefined,
      attachments: values.attachments,
      questions: values.questions,
      status: options?.publish ? "published" : "draft",
    };

    const result = await busyToast.promise(
      fetch("/api/teacher/studio/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to create quiz");
        return data;
      }),
      {
        loading: "Saving quiz...",
        success: options?.publish ? "Quiz published" : "Quiz saved",
        error: "Failed to save quiz",
      }
    );

    const quizId = result?.data?.assignment?.id;
    if (quizId) {
      router.push(`/teacher/studio/quizzes/${quizId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button
          asChild
          variant="outline"
          className="mb-3 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Link href="/teacher/studio/quizzes">
            <ArrowLeft className="h-4 w-4" />
            Back to quizzes
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-white">Create Quiz</h1>
        <p className="text-sm text-white/60">
          Build a quiz and publish when you are ready.
        </p>
      </div>
      <AssignmentBuilder
        initialValues={{ type: "quiz" }}
        onSubmit={handleSubmit}
        showPublish={canPublish}
        layout="wizard"
        allowedTypes={["quiz"]}
      />
    </div>
  );
}
