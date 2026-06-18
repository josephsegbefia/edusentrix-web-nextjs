"use client";

import {
  LESSON_CONTENT_BLOCK_LABELS,
  isTeacherOnlyLessonBlockType,
  type LessonContentBlock,
} from "@/types/lesson-content-blocks";
import {
  BilingualTextBlockView,
  PronunciationBlockView,
  VocabularyBlockView,
} from "@/components/lessons/blocks/LanguageBlockViews";
import { MathExpressionBlockView } from "@/components/lessons/blocks/MathExpressionBlockView";
import { WorkedExampleBlockView } from "@/components/lessons/blocks/WorkedExampleBlockView";
import {
  AssetPlanBlockView,
  AudioBlockView,
  DiagramBlockView,
  IllustrationBlockView,
} from "@/components/lessons/blocks/VisualAssetBlockViews";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LessonContentBlocksViewMode = "teacher" | "student";

type Props = {
  blocks: LessonContentBlock[];
  className?: string;
  viewMode?: LessonContentBlocksViewMode;
};

function LegacyBlockBody({ block }: { block: LessonContentBlock }) {
  if (!block.bodyHtml.trim()) return null;
  return (
    <div
      className="prose prose-invert max-w-none text-sm text-white/75 prose-p:my-2 prose-ul:my-2"
      dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
    />
  );
}

function LessonBlockContent({
  block,
  viewMode,
}: {
  block: LessonContentBlock;
  viewMode: LessonContentBlocksViewMode;
}) {
  const showTeacherWarnings = viewMode === "teacher";

  switch (block.type) {
    case "bilingual_text":
      return <BilingualTextBlockView block={block} showTeacherWarnings={showTeacherWarnings} />;
    case "vocabulary":
      return <VocabularyBlockView block={block} showTeacherWarnings={showTeacherWarnings} />;
    case "pronunciation":
      return <PronunciationBlockView block={block} showTeacherWarnings={showTeacherWarnings} />;
    case "math_expression":
      return <MathExpressionBlockView block={block} showTeacherWarnings={showTeacherWarnings} />;
    case "worked_example":
      return <WorkedExampleBlockView block={block} showTeacherWarnings={showTeacherWarnings} />;
    case "diagram":
      return <DiagramBlockView block={block} showTeacherWarnings={showTeacherWarnings} />;
    case "illustration":
      return <IllustrationBlockView block={block} showTeacherWarnings={showTeacherWarnings} />;
    case "audio":
      return <AudioBlockView block={block} showTeacherWarnings={showTeacherWarnings} />;
    case "asset_plan":
      return showTeacherWarnings ? <AssetPlanBlockView block={block} /> : null;
    default:
      return <LegacyBlockBody block={block} />;
  }
}

export function LessonContentBlocksRenderer({
  blocks,
  className,
  viewMode = "teacher",
}: Props) {
  const visibleBlocks = blocks.filter((block) => {
    if (viewMode === "student" && isTeacherOnlyLessonBlockType(block.type)) {
      return false;
    }
    return true;
  });

  if (visibleBlocks.length === 0) {
    return (
      <p className="text-sm text-white/50">
        No content blocks yet. Add blocks manually or generate with Leo.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {visibleBlocks.map((block) => (
        <article
          key={block.id}
          id={`lesson-block-${block.id}`}
          className="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-teal-500/15 text-teal-100">
              {LESSON_CONTENT_BLOCK_LABELS[block.type] ?? block.type}
            </Badge>
            {block.title ? (
              <span className="text-sm font-medium text-white/90">{block.title}</span>
            ) : null}
            {viewMode === "teacher" && block.aiGenerated ? (
              <Badge
                className={cn(
                  "border-0 text-xs",
                  block.teacherReviewed
                    ? "bg-emerald-500/15 text-emerald-100"
                    : "bg-amber-500/15 text-amber-100",
                )}
              >
                {block.teacherReviewed ? "AI reviewed" : "AI draft"}
              </Badge>
            ) : null}
            {block.estimatedMinutes ? (
              <span className="text-xs text-white/45">{block.estimatedMinutes} min</span>
            ) : null}
          </div>
          <LessonBlockContent block={block} viewMode={viewMode} />
        </article>
      ))}
    </div>
  );
}
