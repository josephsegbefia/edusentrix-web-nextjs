"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import {
  AssignmentBuilder,
  type AssignmentFormValues,
} from "@/components/teacher/studio/AssignmentBuilder";
import {
  readSessionStudioSeed,
  clearSessionStudioSeed,
} from "@/lib/lessons/session-studio-seed-storage";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";

export default function TeacherQuizCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.assignmentsCreate);
  const canPublish = can(permissions, PERMISSIONS.assignmentsPublish);
  const sessionId = searchParams.get("sessionId");
  const useStoredSeed = searchParams.get("seed") === "stored";
  const [seedValues, setSeedValues] = React.useState<Partial<AssignmentFormValues> | null>(null);
  const [isLoadingSeed, setIsLoadingSeed] = React.useState(false);
  const [seedSource, setSeedSource] = React.useState<"none" | "flashcards" | "assessment" | null>(
    null
  );

  React.useEffect(() => {
    let ignore = false;
    if (sessionId && useStoredSeed) {
      const stored = readSessionStudioSeed(sessionId);
      if (stored) {
        setSeedValues({
          title: stored.title,
          instructions: stored.instructions,
          type: "quiz",
          subjectId: stored.subjectId,
          classGroupIds: stored.classGroupIds,
          maxScore: stored.maxScore,
          questions: stored.questions ?? [],
        });
        clearSessionStudioSeed(sessionId);
      }
      return;
    }

    if (!sessionId) {
      setSeedValues(null);
      setSeedSource(null);
      return;
    }

    setIsLoadingSeed(true);
    const seedUrl = `/api/teacher/lesson-sessions/${sessionId}/assignment-seed?type=quiz`;
    void fetch(seedUrl, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | {
              success: true;
              data: {
                title: string;
                instructions: string;
                subjectId: string | null;
                classGroupIds: string[];
                maxScore: number;
                questions?: AssignmentFormValues["questions"];
                questionSeedSource?: "none" | "flashcards" | "assessment";
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
          type: "quiz",
          subjectId: json.data.subjectId || "",
          classGroupIds: json.data.classGroupIds,
          maxScore: json.data.maxScore,
          questions: Array.isArray(json.data.questions) ? json.data.questions : [],
        });
        setSeedSource(json.data.questionSeedSource ?? "none");
      })
      .catch((e: unknown) => {
        if (ignore) return;
        busyToast.warning(e instanceof Error ? e.message : "Could not prefill from lesson");
        setSeedSource(null);
      })
      .finally(() => {
        if (!ignore) setIsLoadingSeed(false);
      });
    return () => {
      ignore = true;
    };
  }, [sessionId, useStoredSeed, busyToast]);

  if (!canCreate) {
    return (
      <WorkspacePageShell>
        <GlassPanel className="p-8 text-center">
          <p className="text-white/70">You do not have permission to create quizzes.</p>
        </GlassPanel>
      </WorkspacePageShell>
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
      sourceSessionId: sessionId || undefined,
      classGroupIds: values.classGroupIds,
      dueDate: values.dueDate.toISOString(),
      latePolicy: values.latePolicy,
      latePenaltyPercent: values.latePenaltyPercent ?? undefined,
      maxScore: values.maxScore,
      quizTimeLimitMinutes: values.quizTimeLimitMinutes ?? undefined,
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
      return { keepSubmitting: true };
    }
  };

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={HelpCircle}
        title="Create quiz"
        subtitle="Build a quiz and publish when you are ready."
        backHref="/teacher/studio/quizzes"
        backLabel="Back to quizzes"
      />
      <AssignmentBuilder
        initialValues={{ type: "quiz", ...(seedValues ?? {}) }}
        onSubmit={handleSubmit}
        showPublish={canPublish}
        layout="wizard"
        allowedTypes={["quiz"]}
      />
      {isLoadingSeed ? (
        <p className="text-xs text-white/50">Prefilling from lesson...</p>
      ) : null}
      {!isLoadingSeed && sessionId && seedSource ? (
        <p className="text-xs text-white/45">
          {seedSource === "flashcards"
            ? "Starter quiz questions loaded from this session's flashcards."
            : seedSource === "assessment"
              ? "Starter quiz questions loaded from this session's assessment content."
              : "No auto-generated starter questions found; quiz starts blank."}
        </p>
      ) : null}
    </WorkspacePageShell>
  );
}
