"use client";

import * as React from "react";
import { Sparkles, Copy, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useLeoLessonDraftMutation,
  type LeoLessonDraftRequest,
  type LeoLessonDraftResponse,
} from "@/hooks/teacher/useLeoLessonDraft";
import { useTeacherCreateFlashcard } from "@/hooks/teacher/useTeacherLessonFlashcards";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherLessonUpdate } from "@/hooks/teacher/useTeacherLessonUpdate";

type Props = {
  lessonId: string;
  lessonNoteId: string;
  canWrite: boolean;
};

type LastResult = {
  label: string;
  payload: LeoLessonDraftResponse;
};

function extractParentSummaryHtml(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const h = (data as { parentSummaryHtml?: unknown }).parentSummaryHtml;
  return typeof h === "string" && h.trim() ? h : null;
}

function extractFlashcardDrafts(data: unknown): Array<{ front: string; back: string }> {
  if (!data || typeof data !== "object") return [];
  const cards = (data as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return [];
  return cards
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const front = String((c as { front?: unknown }).front ?? "").trim();
      const back = String((c as { back?: unknown }).back ?? "").trim();
      if (!front || !back) return null;
      return { front, back };
    })
    .filter((c): c is { front: string; back: string } => c !== null);
}

export function TeacherLessonLeoPanel({ lessonId, lessonNoteId, canWrite }: Props) {
  const busyToast = useBusyToast();
  const { data: teacherCtx } = useTeacherContext();
  const saveLesson = useTeacherLessonUpdate();
  const createFlashcard = useTeacherCreateFlashcard(lessonId);
  const mutation = useLeoLessonDraftMutation();
  const [last, setLast] = React.useState<LastResult | null>(null);
  const [maxCards, setMaxCards] = React.useState(10);
  const [questionCount, setQuestionCount] = React.useState(8);

  const subscription = teacherCtx?.data.subscription;
  const leoBlockedReason = !subscription?.hasAiLessonNotes
    ? "AI lesson drafts are not included in your school's current plan. You can still add flashcards manually below."
    : subscription.expensiveAiBlockedReason;
  const leoEnabled =
    Boolean(subscription?.canUseExpensiveAi && subscription?.hasAiLessonNotes);

  const run = async (label: string, req: LeoLessonDraftRequest) => {
    if (!leoEnabled) {
      busyToast.error(leoBlockedReason || "Leo drafts are not available right now.");
      return;
    }
    try {
      await busyToast.promise(
        mutation.mutateAsync(req).then((payload) => {
          setLast({ label, payload });
          return payload;
        }),
        {
          loading: "Leo is drafting…",
          success: "Draft ready — review before sharing",
          error: (e) => (e instanceof Error ? e.message : "Failed"),
        }
      );
    } catch {
      // Error toast already shown; avoid uncaught mutation errors in the UI overlay.
    }
  };

  const importFlashcards = async () => {
    if (!last) return;
    const drafts = extractFlashcardDrafts(last.payload.data);
    if (drafts.length === 0) {
      busyToast.error("No valid flashcards found in the Leo draft.");
      return;
    }
    try {
      await busyToast.promise(
        (async () => {
          for (const card of drafts) {
            await createFlashcard.mutateAsync(card);
          }
        })(),
        {
          loading: `Adding ${drafts.length} card${drafts.length === 1 ? "" : "s"}…`,
          success: `Added ${drafts.length} flashcard${drafts.length === 1 ? "" : "s"} to this lesson`,
          error: (e) => (e instanceof Error ? e.message : "Failed to add cards"),
        }
      );
    } catch {
      // Toast shown above.
    }
  };

  const copyJson = async () => {
    if (!last) return;
    const data =
      typeof last.payload.data === "object" && last.payload.data !== null
        ? last.payload.data
        : { value: last.payload.data };
    const text = JSON.stringify({ action: last.label, ...data }, null, 2);
    await navigator.clipboard.writeText(text);
  };

  if (!canWrite) return null;

  return (
    <Card className="border border-violet-500/20 bg-linear-to-br from-violet-500/10 via-transparent to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/25 text-violet-100">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg text-white">Leo drafts</CardTitle>
            <p className="text-xs text-white/50">
              AI suggestions from your lesson note — always review; nothing is published automatically.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!leoEnabled && leoBlockedReason ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            {leoBlockedReason}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            disabled={mutation.isPending || !leoEnabled}
            onClick={() =>
              void run("Student summary", { kind: "summary", lessonNoteId })
            }
          >
            Student summary
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            disabled={mutation.isPending || !leoEnabled}
            onClick={() =>
              void run("Quality check", { kind: "quality", lessonNoteId })
            }
          >
            Quality check
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            disabled={mutation.isPending || !leoEnabled}
            onClick={() =>
              void run("Simplify for learners", { kind: "simplify", lessonNoteId })
            }
          >
            Simplify
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            disabled={mutation.isPending || !leoEnabled}
            onClick={() =>
              void run("Differentiated materials", { kind: "differentiate", lessonNoteId })
            }
          >
            Differentiate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            disabled={mutation.isPending || !leoEnabled}
            onClick={() =>
              void run("Parent summary", { kind: "parentSummary", lessonNoteId })
            }
          >
            Parent summary
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            disabled={mutation.isPending || !leoEnabled}
            onClick={() =>
              void run("Suggest activities", { kind: "activities", lessonId })
            }
          >
            Activities
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            disabled={mutation.isPending || !leoEnabled}
            onClick={() =>
              void run("Practice questions", {
                kind: "practice",
                lessonId,
                questionCount,
              })
            }
          >
            Practice questions
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
            disabled={mutation.isPending || !leoEnabled}
            onClick={() =>
              void run("Draft flashcards", {
                kind: "flashcards",
                lessonNoteId,
                maxCards,
              })
            }
          >
            Draft flashcards (Leo)
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/55">Flashcard count (3–30)</Label>
            <Input
              type="number"
              min={3}
              max={30}
              value={maxCards}
              onChange={(e) => setMaxCards(Number(e.target.value) || 10)}
              className="h-9 border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/55">Practice questions (3–20)</Label>
            <Input
              type="number"
              min={3}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value) || 8)}
              className="h-9 border-white/10 bg-white/5 text-white"
            />
          </div>
        </div>

        {last && (
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-white/90">{last.label}</p>
              <div className="flex flex-wrap items-center gap-2">
                {last.label === "Parent summary" && extractParentSummaryHtml(last.payload.data) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                    disabled={saveLesson.isPending}
                    onClick={() => {
                      const html = extractParentSummaryHtml(last.payload.data);
                      if (!html) return;
                      void busyToast.promise(
                        saveLesson.mutateAsync({ id: lessonId, parentSummaryHtml: html }),
                        {
                          loading: "Saving parent summary…",
                          success: "Parent summary saved on this lesson",
                          error: (e) => (e instanceof Error ? e.message : "Save failed"),
                        }
                      );
                    }}
                  >
                    Save to lesson (parents)
                  </Button>
                ) : null}
                {last.label === "Draft flashcards" &&
                extractFlashcardDrafts(last.payload.data).length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 bg-fuchsia-500/20 text-fuchsia-100 hover:bg-fuchsia-500/30"
                    disabled={createFlashcard.isPending}
                    onClick={() => void importFlashcards()}
                  >
                    Add {extractFlashcardDrafts(last.payload.data).length} to flashcard deck
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => void copyJson()}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy JSON
                </Button>
              </div>
            </div>
            {last.payload.disclaimer && (
              <p className="text-xs text-amber-200/80">{last.payload.disclaimer}</p>
            )}
            <pre className="max-h-72 overflow-auto rounded-lg border border-white/5 bg-black/30 p-3 text-xs text-emerald-100/90">
              {JSON.stringify(last.payload.data, null, 2)}
            </pre>
            {last.payload.usage?.totalTokens != null && (
              <p className="text-[11px] text-white/40">
                Tokens: ~{last.payload.usage.totalTokens}
              </p>
            )}
          </div>
        )}

        {mutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-white/55">
            <Loader2 className="h-4 w-4 animate-spin" />
            Working…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
