"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  ClipboardList,
  Loader2,
  Plus,
  Sparkles,
  FileQuestion,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherSessionAssignments } from "@/hooks/teacher/useTeacherSessionAssignments";
import { useGenerateSessionPractice } from "@/hooks/teacher/useLessonsLeo";
import { writeSessionStudioSeed } from "@/lib/lessons/session-studio-seed-storage";
type PracticeSeedQuestion = {
  id: string;
  prompt: string;
  points: number;
  explanation?: string | null;
  choices: Array<{ id: string; text: string; isCorrect: boolean }>;
};
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
  canWrite: boolean;
  leoEnabled: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  practice: "Practice",
  project: "Project",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-200",
  published: "bg-emerald-500/20 text-emerald-200",
  closed: "bg-amber-500/20 text-amber-200",
  archived: "bg-rose-500/20 text-rose-200",
};

function studioPath(
  kind: "assignment" | "quiz" | "practice",
  sessionId: string,
): string {
  if (kind === "quiz") {
    return `/teacher/studio/quizzes/new?sessionId=${sessionId}`;
  }
  const type = kind === "practice" ? "practice" : "assignment";
  return `/teacher/studio/assignments/new?sessionId=${sessionId}&type=${type}`;
}

export function TeacherSessionAssignmentsPanel({ sessionId, canWrite, leoEnabled }: Props) {
  const router = useRouter();
  const busyToast = useBusyToast();
  const { data, isLoading, error, refetch } = useTeacherSessionAssignments(sessionId, true);
  const generatePractice = useGenerateSessionPractice();

  const summary = data?.data.summary;
  const items = data?.data.items ?? [];

  const draftPracticeWithLeo = async () => {
    let questions: PracticeSeedQuestion[] = [];
    busyToast.show("Leo is drafting practice questions…");
    try {
      questions = await generatePractice.mutateAsync({ sessionId, questionCount: 8 });
    } catch (e) {
      busyToast.hide();
      busyToast.error(e instanceof Error ? e.message : "Generation failed");
      return;
    }
    busyToast.hide();
    if (!questions.length) {
      busyToast.info("Leo did not return any questions. Try again or add them in Studio.");
      return;
    }
    busyToast.success(
      `${questions.length} question${questions.length === 1 ? "" : "s"} drafted`,
    );

    const seedRes = await fetch(
      `/api/teacher/lesson-sessions/${sessionId}/assignment-seed?type=practice`,
      { cache: "no-store" },
    );
    const seedJson = await seedRes.json().catch(() => null);
    if (!seedRes.ok || !seedJson?.success) {
      busyToast.warning(seedJson?.error || "Could not load session seed");
      return;
    }

    writeSessionStudioSeed(sessionId, {
      title: seedJson.data.title,
      instructions: seedJson.data.instructions,
      type: "practice",
      subjectId: seedJson.data.subjectId,
      classGroupIds: seedJson.data.classGroupIds,
      maxScore: seedJson.data.maxScore,
      questions: questions.length > 0 ? questions : seedJson.data.questions,
    });
    router.push(`${studioPath("practice", sessionId)}&seed=stored`);
    void refetch();
  };

  return (
    <Card className="border border-white/10 bg-linear-to-br from-violet-500/8 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
            <BookOpenCheck className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg text-white">Homework & assignments</CardTitle>
            <p className="text-xs text-white/50">
              Studio tasks linked to this session — create after you mark it complete.
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              asChild
              className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
            >
              <Link href={studioPath("assignment", sessionId)}>
                <Plus className="mr-1 h-4 w-4" />
                Assignment
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              asChild
              variant="outline"
              className="border-white/10 bg-white/5 text-white/75"
            >
              <Link href={studioPath("quiz", sessionId)}>
                <FileQuestion className="mr-1 h-4 w-4" />
                Quiz
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              asChild
              variant="outline"
              className="border-white/10 bg-white/5 text-white/75"
            >
              <Link href={studioPath("practice", sessionId)}>
                <ClipboardList className="mr-1 h-4 w-4" />
                Practice
              </Link>
            </Button>
            {leoEnabled && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void draftPracticeWithLeo()}
                disabled={generatePractice.isPending}
                className="border-white/10 bg-white/5 text-white/75"
              >
                {generatePractice.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                Leo practice
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/75">
            {summary.total} linked task{summary.total === 1 ? "" : "s"} · {summary.quizCount}{" "}
            quiz{summary.quizCount === 1 ? "" : "zes"} · {summary.assignmentCount} other ·{" "}
            {summary.published} published
            {summary.draft > 0 ? (
              <span className="text-white/45"> ({summary.draft} drafts)</span>
            ) : null}
          </div>
        )}
        {error && <p className="text-sm text-rose-300">{error.message}</p>}
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        ) : items.length === 0 ? (
          <p className="text-sm text-white/50">
            No Studio tasks yet. Create homework, a quiz, or classroom practice exercises from
            this session.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const href =
                item.type === "quiz"
                  ? `/teacher/studio/quizzes/${item.id}`
                  : `/teacher/studio/assignments/${item.id}`;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link href={href} className="font-medium text-white/90 hover:text-white">
                      {item.title}
                    </Link>
                    <p className="text-xs text-white/45">
                      {TYPE_LABEL[item.type] ?? item.type} · due{" "}
                      {new Date(item.dueDate).toLocaleDateString()}
                      {item.submissionCount > 0
                        ? ` · ${item.submissionCount} submission${item.submissionCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                  <Badge className={cn("border-0 capitalize", STATUS_COLOR[item.status])}>
                    {item.status}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
