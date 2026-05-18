"use client";

import { LESSON_CONTENT_BLOCK_LABELS, type LessonContentBlock } from "@/types/lesson-content-blocks";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  blocks: LessonContentBlock[];
  className?: string;
};

export function LessonContentBlocksRenderer({ blocks, className }: Props) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-white/50">No content blocks yet. Add blocks manually or generate with Leo.</p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block) => (
        <article
          key={block.id}
          className="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-teal-500/15 text-teal-100">
              {LESSON_CONTENT_BLOCK_LABELS[block.type]}
            </Badge>
            {block.title ? (
              <span className="text-sm font-medium text-white/90">{block.title}</span>
            ) : null}
            {block.aiGenerated ? (
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
          <div
            className="prose prose-invert max-w-none text-sm text-white/75 prose-p:my-2 prose-ul:my-2"
            dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
          />
        </article>
      ))}
    </div>
  );
}
