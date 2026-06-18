"use client";

import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { getLessonSessionReadiness } from "@/lib/lessons/content-readiness";
import { cn } from "@/lib/utils";

type Props = {
  blocks: LessonContentBlock[];
  requireTeacherReviewForAiContent?: boolean;
  className?: string;
};

type StripStatus = "ready" | "needs_review" | "missing" | "invalid" | "optional" | "blocked" | "pending";

const STATUS_STYLES: Record<StripStatus, string> = {
  ready: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  needs_review: "border-amber-500/25 bg-amber-500/10 text-amber-100",
  missing: "border-rose-500/25 bg-rose-500/10 text-rose-100",
  invalid: "border-rose-500/25 bg-rose-500/10 text-rose-100",
  optional: "border-white/10 bg-white/5 text-white/55",
  blocked: "border-rose-500/25 bg-rose-500/10 text-rose-100",
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-100",
};

function labelForAi(status: string): { label: string; tone: StripStatus } {
  if (status === "pending") return { label: "Pending", tone: "pending" };
  if (status === "ready") return { label: "Ready", tone: "ready" };
  return { label: "Not required", tone: "optional" };
}

function labelForLanguage(status: string): { label: string; tone: StripStatus } {
  if (status === "needs_review") return { label: "Needs review", tone: "needs_review" };
  if (status === "ready") return { label: "Ready", tone: "ready" };
  return { label: "Not required", tone: "optional" };
}

function labelForMath(status: string): { label: string; tone: StripStatus } {
  if (status === "invalid") return { label: "Invalid", tone: "invalid" };
  if (status === "ready") return { label: "Ready", tone: "ready" };
  return { label: "Not required", tone: "optional" };
}

function labelForAssets(status: string): { label: string; tone: StripStatus } {
  if (status === "missing_required_assets") return { label: "Missing", tone: "missing" };
  if (status === "needs_review") return { label: "Needs review", tone: "needs_review" };
  if (status === "ready") return { label: "Ready", tone: "ready" };
  return { label: "Optional", tone: "optional" };
}

function QualityCard({
  title,
  label,
  tone,
}: {
  title: string;
  label: string;
  tone: StripStatus;
}) {
  return (
    <div
      className={cn(
        "min-w-[108px] rounded-xl border px-3 py-2",
        STATUS_STYLES[tone],
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-0.5 text-sm font-medium">{label}</p>
    </div>
  );
}

export function LessonQualityStrip({
  blocks,
  requireTeacherReviewForAiContent = true,
  className,
}: Props) {
  const readiness = getLessonSessionReadiness(blocks, {
    requireTeacherReviewForAiContent,
  });
  const ai = labelForAi(readiness.summary.aiReview);
  const language = labelForLanguage(readiness.summary.language);
  const math = labelForMath(readiness.summary.math);
  const assets = labelForAssets(readiness.summary.assets);
  const audio =
    readiness.summary.audio === "missing"
      ? { label: "Missing", tone: "missing" as const }
      : readiness.summary.audio === "ready"
        ? { label: "Ready", tone: "ready" as const }
        : { label: "Optional", tone: "optional" as const };
  const publish = readiness.canPublish
    ? { label: "Ready", tone: "ready" as const }
    : { label: "Blocked", tone: "blocked" as const };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        <QualityCard title="AI Review" label={ai.label} tone={ai.tone} />
        <QualityCard title="Language" label={language.label} tone={language.tone} />
        <QualityCard title="Math" label={math.label} tone={math.tone} />
        <QualityCard title="Illustrations" label={assets.label} tone={assets.tone} />
        <QualityCard title="Audio" label={audio.label} tone={audio.tone} />
        <QualityCard title="Publish" label={publish.label} tone={publish.tone} />
      </div>
      {readiness.blockingReasons.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-100/85">
          {readiness.blockingReasons.map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
