"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentSessionContentView } from "@/components/lessons/StudentSessionContentView";
import { StudentNotebookNotesView } from "@/components/lessons/StudentNotebookNotesView";
import { useStudentLessonSession } from "@/hooks/student/useStudentLessonSession";
import { useStudentSessionComplete } from "@/hooks/student/useStudentSessionComplete";
import { useStudentSessionResources } from "@/hooks/student/useStudentSessionResources";
import { useStudentSessionFlashcards, useStudentSessionFlashcardProgress } from "@/hooks/student/useStudentSessionFlashcards";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useStudentSessionProgress } from "@/hooks/student/useStudentSessionProgress";
import type { StudentLessonResourceRow } from "@/types/lesson-resources";
import type { FlashcardProgressStatus } from "@/models/StudentFlashcardProgress";

const FLASHCARD_STATUS_LABEL: Record<FlashcardProgressStatus, string> = {
  new: "New",
  learning: "Learning",
  known: "Known",
  needs_review: "Review",
};

function ResourceItem({ item }: { item: StudentLessonResourceRow }) {
  if (item.kind === "library_book") {
    return (
      <Link href={item.libraryPath ?? "#"} className="flex items-center gap-3 group">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/40">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/85 group-hover:text-white">{item.title}</p>
          {item.description && <p className="text-xs text-white/50">{item.description}</p>}
        </div>
      </Link>
    );
  }
  const href = item.kind === "file" ? item.fileUrl : item.url;
  return (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 group"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/40">
        {item.kind === "file" ? (
          <FolderOpen className="h-4 w-4" />
        ) : (
          <ExternalLink className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-white/85 group-hover:text-white">{item.title}</p>
        {item.description && <p className="text-xs text-white/50">{item.description}</p>}
      </div>
    </a>
  );
}

export default function StudentLessonDetailPage() {
  const params = useParams<{ id: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : null;
  const busyToast = useBusyToast();

  const { data, isLoading, error } = useStudentLessonSession(sessionId);
  const completeMut = useStudentSessionComplete(sessionId);
  const { data: resourcesData } = useStudentSessionResources(sessionId, Boolean(data));
  const { data: flashcardsData } = useStudentSessionFlashcards(sessionId, Boolean(data));
  const flashcardProgressMut = useStudentSessionFlashcardProgress(sessionId);
  const { data: progressData } = useStudentSessionProgress(sessionId, Boolean(data));

  const session = data?.data;
  const resources = resourcesData?.data?.items ?? [];
  const flashcardDeck = flashcardsData?.data?.deck ?? null;
  const flashcards = flashcardsData?.data?.cards ?? [];
  const isCompleted = progressData?.data?.completionStatus === "completed";

  // Record view beacon when session loads
  React.useEffect(() => {
    if (!sessionId || !session) return;
    void fetch(`/api/student/lesson-sessions/${sessionId}/view`, { method: "POST" }).catch(
      () => {}
    );
  }, [sessionId, session]);

  const markComplete = () => {
    if (!sessionId || isCompleted) return;
    void busyToast.promise(completeMut.mutateAsync(), {
      loading: "Saving\u2026",
      success: "Marked as studied",
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
  };

  if (error) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <Card className="border border-rose-500/30 bg-rose-500/10">
          <CardContent className="p-5 text-sm text-rose-100">
            {error instanceof Error ? error.message : "Failed to load lesson"}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !session) {
    return (
      <div className="min-h-screen space-y-4 p-6 md:p-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/student/lessons">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-slate-600/60 bg-slate-900/40 text-slate-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            All lessons
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {isCompleted && (
            <Badge variant="outline" className="border-sky-500/35 bg-sky-500/15 text-sky-200">
              You marked this as studied
            </Badge>
          )}
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          >
            Published for your class
          </Badge>
          {session.scheduledDate && (
            <span className="text-xs text-slate-500">
              Scheduled{" "}
              {new Date(`${session.scheduledDate}T00:00:00`).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">{session.title}</h1>

      <StudentSessionContentView blocks={session.blocks} />

      <div className="mt-8 space-y-8">
        {session.notebookNotes ? (
          <StudentNotebookNotesView notes={session.notebookNotes} />
        ) : null}
        {/* Resources */}
        {resources.length > 0 && (
          <Card className="border border-slate-700/80 bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-base text-white">Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {resources.map((item) => (
                <ResourceItem key={item.id} item={item} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Flashcards */}
        {flashcardDeck && flashcards.length > 0 && (
          <Card className="border border-violet-500/25 bg-violet-500/5">
            <CardHeader>
              <CardTitle className="text-base text-white">{flashcardDeck.title}</CardTitle>
              <p className="text-sm text-slate-400">{flashcards.length} flashcard{flashcards.length === 1 ? "" : "s"}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {flashcards.slice(0, 6).map((card) => (
                <div key={card.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white/90">{card.front}</p>
                    {card.progress?.status && (
                      <Badge className="shrink-0 bg-white/10 text-white/60 text-xs">
                        {FLASHCARD_STATUS_LABEL[card.progress.status]}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {(["known", "needs_review", "learning"] as FlashcardProgressStatus[]).map(
                      (s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            void flashcardProgressMut.mutate({ cardId: card.id, body: { status: s } })
                          }
                          className="rounded px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white/80"
                        >
                          {FLASHCARD_STATUS_LABEL[s]}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
              {flashcards.length > 6 && (
                <p className="text-xs text-slate-500">+{flashcards.length - 6} more cards</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mark as studied */}
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-5">
          <p className="text-sm text-slate-300">
            When you have reviewed the lesson (and flashcards if any), you can mark it as
            studied. Your teacher and school may use this for engagement insights.
          </p>
          <Button
            type="button"
            className="mt-3 bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            disabled={isCompleted || completeMut.isPending}
            onClick={() => markComplete()}
          >
            {isCompleted ? "Marked as studied" : "Mark as studied"}
          </Button>
        </div>
      </div>
    </div>
  );
}
