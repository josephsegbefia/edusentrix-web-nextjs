"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, FlipHorizontal, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useStudentLessonFlashcards, useStudentFlashcardProgress } from "@/hooks/student/useStudentLessonFlashcards";
import type { FlashcardProgressStatus } from "@/models/StudentFlashcardProgress";

const STATUS_LABEL: Record<FlashcardProgressStatus, string> = {
  new: "New",
  learning: "Learning",
  known: "Known",
  needs_review: "Review",
};

type Props = {
  lessonId: string;
};

export function StudentLessonFlashcardsStudy({ lessonId }: Props) {
  const { data, isLoading, error } = useStudentLessonFlashcards(lessonId, true);
  const progressMut = useStudentFlashcardProgress(lessonId);
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);

  const cards = data?.data.cards || [];
  const deck = data?.data.deck;

  React.useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [lessonId, cards.length]);

  const card = cards[index];

  const go = (dir: -1 | 1) => {
    setFlipped(false);
    setIndex((i) => {
      const n = i + dir;
      if (n < 0) return cards.length - 1;
      if (n >= cards.length) return 0;
      return n;
    });
  };

  const saveStatus = async (status: FlashcardProgressStatus) => {
    if (!card) return;
    await progressMut.mutateAsync({
      cardId: card.id,
      body: { status },
    });
  };

  if (isLoading) {
    return (
      <Card className="border border-slate-700/80 bg-slate-900/40">
        <CardContent className="py-10 text-center text-sm text-slate-500">Loading flashcards…</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-rose-500/30 bg-rose-500/10">
        <CardContent className="py-4 text-sm text-rose-100">{error.message}</CardContent>
      </Card>
    );
  }

  if (!deck || cards.length === 0) {
    return null;
  }

  return (
    <Card className="border border-slate-700/80 bg-slate-900/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg text-white">Flashcards</CardTitle>
            <p className="text-xs text-slate-500">{deck.title}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Card {index + 1} / {cards.length}
          </span>
          {card.progress && (
            <Badge variant="outline" className="border-slate-600 text-slate-400">
              {STATUS_LABEL[card.progress.status]} · {card.progress.reviewCount} reviews
            </Badge>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="relative min-h-[200px] w-full rounded-2xl border border-slate-600/60 bg-linear-to-br from-slate-800/90 to-slate-900/90 p-6 text-left shadow-inner transition-all hover:border-violet-500/40"
        >
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <FlipHorizontal className="h-3.5 w-3.5" />
            {flipped ? "Answer" : "Question"}
          </div>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-100">
            {flipped ? card.back : card.front}
          </p>
          <p className="mt-4 text-center text-xs text-slate-500">Tap to flip</p>
        </button>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => go(-1)}
            className="border-slate-600 text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => go(1)}
            className="border-slate-600 text-slate-200"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">How well do you know this card?</p>
          <PremiumSelect
            value={card.progress?.status ?? "new"}
            onValueChange={(v) => void saveStatus(v as FlashcardProgressStatus)}
            disabled={progressMut.isPending}
          >
            <PremiumSelectTrigger className="w-full border-slate-600 bg-slate-900/50 text-slate-100">
              <PremiumSelectValue placeholder="Set progress" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {(Object.keys(STATUS_LABEL) as FlashcardProgressStatus[]).map((k) => (
                <PremiumSelectItem key={k} value={k}>
                  {STATUS_LABEL[k]}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      </CardContent>
    </Card>
  );
}
