"use client";

import { LessonDiagramView } from "@/components/lessons/diagrams/LessonDiagramView";
import { cn } from "@/lib/utils";
import type { TeachingSlide } from "@/types/teaching-deck";
import "katex/dist/katex.min.css";

export const TEACHING_SLIDE_TYPE_LABELS: Record<string, string> = {
  title: "Lesson Start",
  content_block: "Content",
  activity: "Activity",
  check: "Quick Check",
  discussion: "Discussion",
  exit_ticket: "Exit Ticket",
  resource: "Visual",
  timer: "Timer",
  plan_notes: "Teacher Notes",
};

export const TEACHING_SLIDE_TYPE_COLORS: Record<string, string> = {
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

function isImageResourceUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url) || url.includes("utfs.io");
}

function SlideBody({ bodyHtml }: { bodyHtml: string }) {
  return (
    <div
      className="teaching-slide-body prose prose-invert mx-auto max-w-3xl text-left text-lg prose-p:leading-relaxed [&_.katex]:text-white"
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}

export function TeachingSlideView({ slide }: { slide: TeachingSlide }) {
  const typeLabel = TEACHING_SLIDE_TYPE_LABELS[slide.type] ?? slide.type;
  const typeColor = TEACHING_SLIDE_TYPE_COLORS[slide.type] ?? "text-white/60";
  const showDiagram =
    slide.contentBlockType === "diagram" && slide.diagramMeta?.diagramType;
  const bodyHasImage = Boolean(slide.bodyHtml?.includes("<img"));

  if (slide.type === "timer") {
    return (
      <div className="text-center">
        <p className={cn("text-xs uppercase tracking-widest", typeColor)}>{typeLabel}</p>
        <p className="mt-2 text-3xl font-semibold">{slide.title}</p>
        {slide.timerMinutes ? (
          <p className="mt-4 text-6xl font-bold text-teal-300">{slide.timerMinutes} min</p>
        ) : null}
        {slide.bodyHtml ? <SlideBody bodyHtml={slide.bodyHtml} /> : null}
      </div>
    );
  }

  if (slide.type === "check" || slide.type === "discussion" || slide.type === "exit_ticket") {
    return (
      <div className="max-w-2xl text-center">
        <p className={cn("text-xs uppercase tracking-widest", typeColor)}>{typeLabel}</p>
        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{slide.title}</h2>
        {slide.bodyHtml ? (
          <div className="mt-8">
            <SlideBody bodyHtml={slide.bodyHtml} />
          </div>
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
          <div className="mt-8">
            <SlideBody bodyHtml={slide.bodyHtml} />
          </div>
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
      {showDiagram ? (
        <div className="mx-auto mt-8 max-w-lg">
          <LessonDiagramView diagramMeta={slide.diagramMeta} />
        </div>
      ) : null}
      {slide.bodyHtml ? (
        <div className="mt-8">
          <SlideBody bodyHtml={slide.bodyHtml} />
        </div>
      ) : slide.speakerNotes ? (
        <p className="mt-8 text-lg text-white/60">See speaker notes →</p>
      ) : null}
      {slide.resourceUrl && !bodyHasImage && !isImageResourceUrl(slide.resourceUrl) ? (
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
