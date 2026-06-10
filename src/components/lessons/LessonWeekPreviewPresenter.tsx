"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  PanelRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildTeachingDeckFromSessionInput } from "@/lib/lessons/build-teaching-deck-shared";
import { TeachingSlideView } from "@/components/lessons/TeachingSlideView";
import type { LessonPreviewSession } from "@/types/lesson-preview";
import { cn } from "@/lib/utils";

type Props = {
  weekTitle: string;
  weekLabel?: string | null;
  sessions: LessonPreviewSession[];
  onClose: () => void;
  /** When true, renders as a fixed fullscreen overlay (wizard modal). */
  overlay?: boolean;
};

export function LessonWeekPreviewPresenter({
  weekTitle,
  weekLabel,
  sessions,
  onClose,
  overlay = true,
}: Props) {
  const sorted = React.useMemo(
    () => [...sessions].sort((a, b) => a.sequenceInWeek - b.sequenceInWeek),
    [sessions],
  );

  const [sessionIdx, setSessionIdx] = React.useState(0);
  const [slideIdx, setSlideIdx] = React.useState(0);

  const activeSession = sorted[sessionIdx] ?? null;
  const deck = React.useMemo(
    () =>
      activeSession
        ? buildTeachingDeckFromSessionInput({
            title: activeSession.title,
            scheduledDate: activeSession.scheduledDate,
            startTime: activeSession.startTime,
            endTime: activeSession.endTime,
            planNotes: activeSession.planNotes,
            contentBlocks: activeSession.contentBlocks,
            contentVersion: activeSession.contentVersion,
          })
        : null,
    [activeSession],
  );

  const slides = deck?.slides ?? [];
  const slide = slides[slideIdx] ?? null;

  React.useEffect(() => {
    setSlideIdx(0);
  }, [sessionIdx]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (slideIdx < slides.length - 1) {
          setSlideIdx((i) => Math.min(slides.length - 1, i + 1));
        } else if (sessionIdx < sorted.length - 1) {
          setSessionIdx((i) => i + 1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (slideIdx > 0) {
          setSlideIdx((i) => Math.max(0, i - 1));
        } else if (sessionIdx > 0) {
          setSessionIdx((i) => i - 1);
          const prevSession = sorted[sessionIdx - 1];
          if (prevSession) {
            const prevDeck = buildTeachingDeckFromSessionInput({
              title: prevSession.title,
              scheduledDate: prevSession.scheduledDate,
              startTime: prevSession.startTime,
              endTime: prevSession.endTime,
              planNotes: prevSession.planNotes,
              contentBlocks: prevSession.contentBlocks,
              contentVersion: prevSession.contentVersion,
            });
            setSlideIdx(Math.max(0, prevDeck.slides.length - 1));
          }
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sessionIdx, slideIdx, slides.length, sorted]);

  const shell = (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-sm font-semibold">{weekTitle}</p>
            <p className="text-xs text-white/50">
              {weekLabel ? `${weekLabel} · ` : ""}
              Preview mode — same layout as teaching
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-0 bg-violet-500/20 text-violet-200">
            <Eye className="mr-1 h-3 w-3" />
            Preview
          </Badge>
          {activeSession ? (
            <Badge className="border-0 bg-white/10 text-white/80">
              Session {activeSession.sequenceInWeek} of {sorted.length}
            </Badge>
          ) : null}
        </div>
      </header>

      {sorted.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 bg-black/20 px-4 py-2">
          {sorted.map((s, index) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSessionIdx(index)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs transition",
                sessionIdx === index
                  ? "bg-teal-500/25 text-teal-100"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      ) : null}

      {slides.length > 0 ? (
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full bg-teal-400/60 transition-all duration-300"
            style={{ width: `${((slideIdx + 1) / slides.length) * 100}%` }}
          />
        </div>
      ) : null}

      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-12">
          {activeSession && activeSession.contentBlocks.length === 0 ? (
            <div className="max-w-md text-center">
              <PanelRight className="mx-auto h-8 w-8 text-white/20" />
              <p className="mt-3 text-white/70">{activeSession.title}</p>
              <p className="mt-2 text-sm text-white/45">
                No content blocks yet for this period. Generate session content in the week plan
                wizard, or add blocks on the session page.
              </p>
            </div>
          ) : slide ? (
            <TeachingSlideView slide={slide} />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <PanelRight className="h-8 w-8 text-white/20" />
              <p className="text-white/50">No slides to preview.</p>
            </div>
          )}
        </div>

        {slide?.speakerNotes ? (
          <aside className="hidden w-80 border-l border-white/10 bg-black/30 p-5 lg:block">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/45">
              Speaker notes
            </p>
            <p className="whitespace-pre-wrap text-sm text-white/75">{slide.speakerNotes}</p>
          </aside>
        ) : null}
      </main>

      <footer className="flex items-center justify-between border-t border-white/10 bg-black/40 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          disabled={slideIdx <= 0 && sessionIdx <= 0}
          onClick={() => {
            if (slideIdx > 0) {
              setSlideIdx((i) => Math.max(0, i - 1));
              return;
            }
            if (sessionIdx > 0) {
              const nextIdx = sessionIdx - 1;
              setSessionIdx(nextIdx);
              const prev = sorted[nextIdx];
              if (prev) {
                const prevDeck = buildTeachingDeckFromSessionInput({
                  title: prev.title,
                  scheduledDate: prev.scheduledDate,
                  startTime: prev.startTime,
                  endTime: prev.endTime,
                  planNotes: prev.planNotes,
                  contentBlocks: prev.contentBlocks,
                  contentVersion: prev.contentVersion,
                });
                setSlideIdx(Math.max(0, prevDeck.slides.length - 1));
              }
            }
          }}
          className="text-white/80 hover:bg-white/10"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <p className="text-sm text-white/50">
          {activeSession ? (
            <>
              {activeSession.scheduledDate} · {activeSession.startTime}–{activeSession.endTime}
              {slides.length ? ` · ${slideIdx + 1} / ${slides.length}` : ""}
            </>
          ) : (
            "No sessions"
          )}
        </p>
        <Button
          type="button"
          variant="ghost"
          disabled={slideIdx >= slides.length - 1 && sessionIdx >= sorted.length - 1}
          onClick={() => {
            if (slideIdx < slides.length - 1) {
              setSlideIdx((i) => Math.min(slides.length - 1, i + 1));
              return;
            }
            if (sessionIdx < sorted.length - 1) {
              setSessionIdx((i) => i + 1);
            }
          }}
          className="text-white/80 hover:bg-white/10"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </footer>
    </div>
  );

  if (!overlay) return shell;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">{shell}</div>
  );
}
