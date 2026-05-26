"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MonitorPlay,
  PanelRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useEndLessonTeach,
  useLessonSessionTeach,
  useStartLessonTeach,
} from "@/hooks/teacher/useLessonSessionTeach";
import { useBusyToast } from "@/hooks/useBusyToast";
import { TeachAttendanceModal } from "@/components/lessons/TeachAttendanceModal";
import { SessionBoardNotesPanel } from "@/components/lessons/SessionBoardNotesPanel";
import type { TeachingSlide } from "@/types/teaching-deck";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
};

const SLIDE_TYPE_LABELS: Record<string, string> = {
  title: "Lesson Start",
  content_block: "Content",
  activity: "Activity",
  check: "Quick Check",
  discussion: "Discussion",
  exit_ticket: "Exit Ticket",
  resource: "Resource",
  timer: "Timer",
  plan_notes: "Teacher Notes",
};

const SLIDE_TYPE_COLORS: Record<string, string> = {
  title: "text-teal-300",
  content_block: "text-white/60",
  activity: "text-amber-300",
  check: "text-sky-300",
  discussion: "text-violet-300",
  exit_ticket: "text-rose-300",
  resource: "text-emerald-300",
  timer: "text-orange-300",
  plan_notes: "text-white/40",
};

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SessionTeachingPresenter({ sessionId }: Props) {
  const router = useRouter();
  const busyToast = useBusyToast();
  const { data, isLoading, error, refetch } = useLessonSessionTeach(sessionId);
  const startTeach = useStartLessonTeach(sessionId);
  const endTeach = useEndLessonTeach(sessionId);

  const [slideIdx, setSlideIdx] = React.useState(0);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const [showBoardNotes, setShowBoardNotes] = React.useState(false);
  const [showPostAttendance, setShowPostAttendance] = React.useState(false);

  const ctx = data?.data;
  const slides = ctx?.deck.slides ?? [];
  const slide = slides[slideIdx] ?? null;
  const deliveryStatus = ctx?.delivery.status ?? "scheduled";

  // Board notes loaded separately
  const [boardNotes, setBoardNotes] = React.useState<{
    contentHtml: string;
    generatedAt: string | Date;
    aiGenerated: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (!sessionId) return;
    void fetch(`/api/teacher/lesson-sessions/${sessionId}/board-notes`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && json.data?.boardNotes) {
          setBoardNotes(json.data.boardNotes as typeof boardNotes);
        }
      })
      .catch(() => null);
  }, [sessionId]);

  React.useEffect(() => {
    if (deliveryStatus === "in_progress" || deliveryStatus === "delivered") {
      setStarted(true);
    }
  }, [deliveryStatus]);

  React.useEffect(() => {
    if (!started) return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [started]);

  const handleStart = async () => {
    await busyToast.promise(startTeach.mutateAsync(), {
      loading: "Starting lesson…",
      success: "Teaching started",
      error: (e) => (e instanceof Error ? e.message : "Failed to start"),
    });
    setStarted(true);
    void refetch();
  };

  const handleEndClick = () => {
    // Show post-lesson attendance modal before ending
    setShowPostAttendance(true);
  };

  const handlePostAttendanceSubmitted = async () => {
    setShowPostAttendance(false);
    await busyToast.promise(endTeach.mutateAsync(), {
      loading: "Ending lesson…",
      success: "Marked as delivered",
      error: (e) => (e instanceof Error ? e.message : "Failed to end"),
    });
    router.push(`/teacher/lessons/sessions/${sessionId}`);
  };

  const handleSkipPostAttendance = async () => {
    setShowPostAttendance(false);
    await busyToast.promise(endTeach.mutateAsync(), {
      loading: "Ending lesson…",
      success: "Marked as delivered",
      error: (e) => (e instanceof Error ? e.message : "Failed to end"),
    });
    router.push(`/teacher/lessons/sessions/${sessionId}`);
  };

  // Keyboard navigation
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setSlideIdx((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setSlideIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-rose-300">{error.message}</p>
      </div>
    );
  }

  if (isLoading || !ctx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-teal-300" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              asChild
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Link href={`/teacher/lessons/sessions/${sessionId}`}>
                <X className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <p className="text-sm font-semibold">{ctx.session.title}</p>
              <p className="text-xs text-white/50">
                {ctx.session.scheduledDate} · {ctx.session.startTime}–{ctx.session.endTime}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Elapsed timer */}
            <Badge className="border-0 bg-white/10 font-mono text-white/80">
              {formatElapsed(elapsedSec)}
            </Badge>

            {/* Delivery status */}
            <Badge
              className={cn(
                "border-0 capitalize",
                deliveryStatus === "in_progress"
                  ? "bg-sky-500/20 text-sky-200"
                  : deliveryStatus === "delivered"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-slate-500/20 text-slate-200",
              )}
            >
              {deliveryStatus.replace("_", " ")}
            </Badge>

            {/* Board notes toggle */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowBoardNotes((v) => !v)}
              className={cn(
                "h-auto gap-1.5 px-3 py-1.5 text-xs",
                showBoardNotes
                  ? "bg-violet-500/20 text-violet-200"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Board Notes
            </Button>

            {/* Start teaching */}
            {!started && deliveryStatus === "scheduled" ? (
              <Button
                type="button"
                onClick={() => void handleStart()}
                disabled={startTeach.isPending}
                className="bg-teal-500/30 text-teal-100 hover:bg-teal-500/40"
              >
                {startTeach.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MonitorPlay className="mr-2 h-4 w-4" />
                )}
                Start teaching
              </Button>
            ) : null}

            {/* End & mark delivered */}
            {deliveryStatus === "in_progress" || started ? (
              <Button
                type="button"
                onClick={() => void handleEndClick()}
                disabled={endTeach.isPending}
                className="bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35"
              >
                {endTeach.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                End &amp; mark delivered
              </Button>
            ) : null}
          </div>
        </header>

        {/* Progress bar */}
        {slides.length > 0 ? (
          <div className="h-0.5 bg-white/5">
            <div
              className="h-full bg-teal-400/60 transition-all duration-300"
              style={{ width: `${((slideIdx + 1) / slides.length) * 100}%` }}
            />
          </div>
        ) : null}

        {/* Main area */}
        <main className="flex flex-1 overflow-hidden">
          {/* Slide area */}
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center p-6 transition-all lg:p-12",
              showBoardNotes && "lg:w-1/2 lg:flex-none",
            )}
          >
            {slide ? (
              <SlideView slide={slide} />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <PanelRight className="h-8 w-8 text-white/20" />
                <p className="text-white/50">No slides in this deck. Add content blocks on the session page.</p>
              </div>
            )}
          </div>

          {/* Speaker notes (desktop) */}
          {slide?.speakerNotes && !showBoardNotes ? (
            <aside className="hidden w-80 border-l border-white/10 bg-black/30 p-5 lg:block">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/45">
                Speaker notes
              </p>
              <p className="whitespace-pre-wrap text-sm text-white/75">{slide.speakerNotes}</p>
            </aside>
          ) : null}

          {/* Board notes panel */}
          {showBoardNotes ? (
            <aside className="flex w-full flex-col border-l border-white/10 bg-black/40 lg:w-96">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-300" />
                  <span className="text-sm font-medium text-white">Board Notes</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBoardNotes(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <SessionBoardNotesPanel
                  sessionId={sessionId}
                  initialNotes={boardNotes}
                  canWrite
                  leoEnabled
                  onSaved={(saved) => setBoardNotes(saved)}
                />
              </div>
            </aside>
          ) : null}
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-white/10 bg-black/40 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            disabled={slideIdx <= 0}
            onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
            className="text-white/80 hover:bg-white/10"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <p className="text-sm text-white/50">
            {slides.length ? `${slideIdx + 1} / ${slides.length}` : "0 slides"}
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={slideIdx >= slides.length - 1}
            onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
            className="text-white/80 hover:bg-white/10"
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </footer>
      </div>

      {/* Post-lesson attendance modal */}
      {showPostAttendance ? (
        <PostAttendanceDialog
          sessionId={sessionId}
          onSkip={() => void handleSkipPostAttendance()}
          onSubmitted={() => void handlePostAttendanceSubmitted()}
        />
      ) : null}
    </>
  );
}

/** Wrapper that shows the post attendance modal with a "Skip" option */
function PostAttendanceDialog({
  sessionId,
  onSkip,
  onSubmitted,
}: {
  sessionId: string;
  onSkip: () => void;
  onSubmitted: () => void;
}) {
  const [mode, setMode] = React.useState<"prompt" | "attendance">("prompt");

  if (mode === "attendance") {
    return (
      <TeachAttendanceModal
        sessionId={sessionId}
        phase="post"
        open
        onClose={onSkip}
        onSubmitted={onSubmitted}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/40">
        <h3 className="text-base font-semibold text-white">End lesson session?</h3>
        <p className="mt-2 text-sm text-white/60">
          Would you like to record post-lesson attendance before marking this session as delivered?
          This helps capture students who left early or arrived late.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            onClick={() => setMode("attendance")}
            className="w-full bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
          >
            Take post-lesson attendance
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            className="w-full text-white/50 hover:bg-white/5 hover:text-white"
          >
            Skip &amp; end lesson
          </Button>
        </div>
      </div>
    </div>
  );
}

function SlideView({ slide }: { slide: TeachingSlide }) {
  const typeLabel = SLIDE_TYPE_LABELS[slide.type] ?? slide.type;
  const typeColor = SLIDE_TYPE_COLORS[slide.type] ?? "text-white/60";

  if (slide.type === "timer") {
    return (
      <div className="text-center">
        <p className={cn("text-xs uppercase tracking-widest", typeColor)}>{typeLabel}</p>
        <p className="mt-2 text-3xl font-semibold">{slide.title}</p>
        {slide.timerMinutes ? (
          <p className="mt-4 text-6xl font-bold text-teal-300">{slide.timerMinutes} min</p>
        ) : null}
        {slide.bodyHtml ? (
          <div
            className="prose prose-invert mx-auto mt-6 max-w-2xl text-lg"
            dangerouslySetInnerHTML={{ __html: slide.bodyHtml }}
          />
        ) : null}
      </div>
    );
  }

  if (slide.type === "check" || slide.type === "discussion" || slide.type === "exit_ticket") {
    return (
      <div className="max-w-2xl text-center">
        <p className={cn("text-xs uppercase tracking-widest", typeColor)}>{typeLabel}</p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{slide.title}</h2>
        {slide.bodyHtml ? (
          <div
            className="prose prose-invert mx-auto mt-8 max-w-2xl text-left text-lg"
            dangerouslySetInnerHTML={{ __html: slide.bodyHtml }}
          />
        ) : null}
        {slide.type === "check" ? (
          <div className="mt-8 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-6 py-4">
            <p className="text-sm text-sky-200/80">Ask students to respond before moving on.</p>
          </div>
        ) : null}
        {slide.type === "exit_ticket" ? (
          <div className="mt-8 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-6 py-4">
            <p className="text-sm text-rose-200/80">Collect student responses before dismissal.</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (slide.type === "activity") {
    return (
      <div className="max-w-3xl text-center">
        <p className={cn("text-xs uppercase tracking-widest", typeColor)}>{typeLabel}</p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{slide.title}</h2>
        {slide.estimatedMinutes ? (
          <p className="mt-2 text-sm text-amber-300/70">{slide.estimatedMinutes} min</p>
        ) : null}
        {slide.bodyHtml ? (
          <div
            className="prose prose-invert mx-auto mt-8 max-w-3xl text-left text-lg"
            dangerouslySetInnerHTML={{ __html: slide.bodyHtml }}
          />
        ) : null}
        <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-6 py-3">
          <p className="text-sm text-amber-200/80">Allow time for student activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl text-center">
      <p className={cn("text-xs uppercase tracking-widest", typeColor)}>{typeLabel}</p>
      <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{slide.title}</h2>
      {slide.bodyHtml ? (
        <div
          className="prose prose-invert mx-auto mt-8 max-w-3xl text-left text-lg prose-p:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: slide.bodyHtml }}
        />
      ) : slide.speakerNotes ? (
        <p className="mt-8 text-lg text-white/60">See speaker notes →</p>
      ) : null}
      {slide.resourceUrl ? (
        <p className="mt-6">
          <a
            href={slide.resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-300 underline"
          >
            Open resource
          </a>
        </p>
      ) : null}
    </div>
  );
}
