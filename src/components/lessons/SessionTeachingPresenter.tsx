"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MonitorPlay,
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
import type { TeachingSlide } from "@/types/teaching-deck";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
};

export function SessionTeachingPresenter({ sessionId }: Props) {
  const router = useRouter();
  const busyToast = useBusyToast();
  const { data, isLoading, error, refetch } = useLessonSessionTeach(sessionId);
  const startTeach = useStartLessonTeach(sessionId);
  const endTeach = useEndLessonTeach(sessionId);

  const [slideIdx, setSlideIdx] = React.useState(0);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [started, setStarted] = React.useState(false);

  const ctx = data?.data;
  const slides = ctx?.deck.slides ?? [];
  const slide = slides[slideIdx] ?? null;
  const deliveryStatus = ctx?.delivery.status ?? "scheduled";

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

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleStart = async () => {
    await busyToast.promise(startTeach.mutateAsync(), {
      loading: "Starting lesson…",
      success: "Teaching started",
      error: (e) => (e instanceof Error ? e.message : "Failed to start"),
    });
    setStarted(true);
    void refetch();
  };

  const handleEnd = async () => {
    await busyToast.promise(endTeach.mutateAsync(), {
      loading: "Ending lesson…",
      success: "Marked as delivered",
      error: (e) => (e instanceof Error ? e.message : "Failed to end"),
    });
    router.push(`/teacher/lessons/sessions/${sessionId}`);
  };

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
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
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
          <Badge className="border-0 bg-white/10 text-white/80">
            {formatElapsed(elapsedSec)}
          </Badge>
          <Badge
            className={cn(
              "border-0 capitalize",
              deliveryStatus === "in_progress"
                ? "bg-sky-500/20 text-sky-200"
                : deliveryStatus === "delivered"
                  ? "bg-violet-500/20 text-violet-200"
                  : "bg-slate-500/20 text-slate-200",
            )}
          >
            {deliveryStatus.replace("_", " ")}
          </Badge>
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
          {deliveryStatus === "in_progress" || started ? (
            <Button
              type="button"
              onClick={() => void handleEnd()}
              disabled={endTeach.isPending}
              className="bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35"
            >
              {endTeach.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              End & mark delivered
            </Button>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-12">
          {slide ? (
            <SlideView slide={slide} />
          ) : (
            <p className="text-white/50">No slides in this deck. Add content blocks on the session page.</p>
          )}
        </div>
        {slide?.speakerNotes ? (
          <aside className="w-full border-t border-white/10 bg-black/30 p-4 lg:w-80 lg:border-t-0 lg:border-l">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/45">Speaker notes</p>
            <p className="whitespace-pre-wrap text-sm text-white/75">{slide.speakerNotes}</p>
          </aside>
        ) : null}
      </main>

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
          Slide {slides.length ? slideIdx + 1 : 0} of {slides.length}
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
  );
}

function SlideView({ slide }: { slide: TeachingSlide }) {
  if (slide.type === "timer") {
    return (
      <div className="text-center">
        <p className="text-3xl font-semibold">{slide.title}</p>
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

  return (
    <div className="max-w-4xl text-center">
      <p className="text-sm uppercase tracking-widest text-teal-300/80">{slide.type.replace("_", " ")}</p>
      <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{slide.title}</h2>
      {slide.bodyHtml ? (
        <div
          className="prose prose-invert mx-auto mt-8 max-w-3xl text-left text-lg prose-p:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: slide.bodyHtml }}
        />
      ) : slide.speakerNotes ? (
        <p className="mt-8 text-lg text-white/60">See speaker notes panel →</p>
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
