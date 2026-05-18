"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { AssignmentBuilder, type AssignmentFormValues } from "@/components/teacher/studio/AssignmentBuilder";
import {
  readSessionStudioSeed,
  clearSessionStudioSeed,
} from "@/lib/lessons/session-studio-seed-storage";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherAssignmentCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.assignmentsCreate);
  const canPublish = can(permissions, PERMISSIONS.assignmentsPublish);
  const requestedType = searchParams.get("type");
  const lessonId = searchParams.get("lessonId");
  const sessionId = searchParams.get("sessionId");
  const useStoredSeed = searchParams.get("seed") === "stored";
  const [seedValues, setSeedValues] = React.useState<Partial<AssignmentFormValues> | null>(null);
  const [isLoadingSeed, setIsLoadingSeed] = React.useState(false);
  const initialType: AssignmentFormValues["type"] =
    requestedType === "project" || requestedType === "practice"
      ? requestedType
      : "assignment";

  React.useEffect(() => {
    let ignore = false;
    if (sessionId && useStoredSeed) {
      const stored = readSessionStudioSeed(sessionId);
      if (stored) {
        setSeedValues({
          title: stored.title,
          instructions: stored.instructions,
          type: stored.type,
          subjectId: stored.subjectId,
          classGroupIds: stored.classGroupIds,
          maxScore: stored.maxScore,
          questions: stored.questions ?? [],
        });
        clearSessionStudioSeed(sessionId);
      }
      return;
    }

    if (!lessonId && !sessionId) {
      setSeedValues(null);
      return;
    }

    setIsLoadingSeed(true);
    const seedUrl = sessionId
      ? `/api/teacher/lesson-sessions/${sessionId}/assignment-seed?type=${initialType}`
      : `/api/teacher/lessons/${lessonId}/assignment-seed?type=${initialType}`;
    void fetch(seedUrl, {
      cache: "no-store",
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | {
              success: true;
              data: {
                title: string;
                instructions: string;
                type: AssignmentFormValues["type"];
                subjectId: string | null;
                classGroupIds: string[];
                maxScore: number;
              };
            }
          | { success: false; error?: string }
          | null;

        if (!res.ok || !json || !json.success) {
          throw new Error(
            json && "error" in json && typeof json.error === "string"
              ? json.error
              : "Failed to load lesson seed"
          );
        }
        if (ignore) return;
        setSeedValues({
          title: json.data.title,
          instructions: json.data.instructions,
          type: json.data.type,
          subjectId: json.data.subjectId || "",
          classGroupIds: json.data.classGroupIds,
          maxScore: json.data.maxScore,
        });
      })
      .catch((e: unknown) => {
        if (ignore) return;
        busyToast.warning(e instanceof Error ? e.message : "Could not prefill from lesson");
      })
      .finally(() => {
        if (!ignore) setIsLoadingSeed(false);
      });

    return () => {
      ignore = true;
    };
  }, [lessonId, sessionId, useStoredSeed, initialType, busyToast]);

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
      sourceLessonId: lessonId || undefined,
      sourceSessionId: sessionId || undefined,
      classGroupIds: values.classGroupIds,
      dueDate: values.dueDate.toISOString(),
      latePolicy: values.latePolicy,
      latePenaltyPercent: values.latePenaltyPercent ?? undefined,
      maxScore: values.maxScore,
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
        <Button
          asChild
          variant="outline"
          className="mb-3 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Link href="/teacher/studio/assignments">
            <ArrowLeft className="h-4 w-4" />
            Back to assignments
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-white">Create Assignment</h1>
        <p className="text-sm text-white/60">
          Build a new assignment and publish when you are ready.
        </p>
      </div>
      <AssignmentBuilder
        initialValues={{ type: initialType, ...(seedValues ?? {}) }}
        onSubmit={handleSubmit}
        showPublish={canPublish}
        layout="wizard"
        allowedTypes={["assignment", "project", "practice"]}
      />
      {isLoadingSeed ? (
        <p className="text-xs text-white/50">Prefilling from lesson...</p>
      ) : null}
    </div>
  );
}
