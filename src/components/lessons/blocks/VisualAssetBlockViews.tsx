"use client";

import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { LessonIllustrationPreview } from "@/components/lessons/LessonIllustrationPreview";
import { LessonDiagramView } from "@/components/lessons/diagrams/LessonDiagramView";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  block: LessonContentBlock;
  showTeacherWarnings?: boolean;
};

function AssetStatusBadge({ block }: { block: LessonContentBlock }) {
  const status = block.assetMeta?.assetStatus;
  if (!status || status === "approved") return null;
  const label =
    status === "draft" || status === "needs_review"
      ? "Needs approval"
      : status === "missing" || status === "planned"
        ? "Asset missing"
        : status;
  return (
    <Badge className="border-0 bg-amber-500/15 text-xs text-amber-100">{label}</Badge>
  );
}

export function DiagramBlockView({ block, showTeacherWarnings = false }: Props) {
  const altText =
    block.assetMeta?.altText || block.accessibilityMeta?.altText || block.title || null;

  return (
    <div className="space-y-3">
      {showTeacherWarnings ? <AssetStatusBadge block={block} /> : null}
      <LessonDiagramView diagramMeta={block.diagramMeta} altText={altText} />
      {block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/75"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : null}
    </div>
  );
}

export function IllustrationBlockView({ block, showTeacherWarnings = false }: Props) {
  const url = block.resourceUrl?.trim();
  const caption = block.assetMeta?.caption || block.accessibilityMeta?.caption;
  const altText =
    block.assetMeta?.altText || block.accessibilityMeta?.altText || block.title || "Lesson illustration";

  return (
    <div className="space-y-3">
      {showTeacherWarnings ? <AssetStatusBadge block={block} /> : null}
      {url ? (
        <figure className="space-y-2">
          <LessonIllustrationPreview
            src={url}
            alt={altText}
            className="max-w-[280px]"
          />
          {caption ? <figcaption className="text-xs text-white/55">{caption}</figcaption> : null}
        </figure>
      ) : showTeacherWarnings ? (
        <p className={cn("rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90")}>
          Upload an image or generate an AI draft, then add alt text before publishing.
        </p>
      ) : null}
      {block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/75"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : null}
    </div>
  );
}

export function AudioBlockView({ block, showTeacherWarnings = false }: Props) {
  const url = block.resourceUrl?.trim();
  const caption = block.assetMeta?.caption || block.accessibilityMeta?.caption;
  const transcript = block.accessibilityMeta?.transcript;

  return (
    <div className="space-y-3">
      {showTeacherWarnings ? <AssetStatusBadge block={block} /> : null}
      {url ? <audio controls src={url} className="w-full max-w-md" /> : showTeacherWarnings ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Audio file missing. Upload or attach audio before publishing.
        </p>
      ) : null}
      {caption ? <p className="text-sm text-white/60">{caption}</p> : null}
      {transcript && showTeacherWarnings ? (
        <p className="text-xs text-white/45">Transcript: {transcript}</p>
      ) : null}
      {block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/75"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : null}
    </div>
  );
}

export function AssetPlanBlockView({ block }: Props) {
  return (
    <div className="space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-violet-200/80">
        Suggested lesson assets
      </p>
      {block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/75"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : (
        <p className="text-sm text-white/55">No asset plan details yet.</p>
      )}
    </div>
  );
}
