"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LESSON_CONTENT_BLOCK_LABELS, type LessonContentBlockType } from "@/types/lesson-content-blocks";

const BLOCK_ACCENT: Record<LessonContentBlockType, string> = {
  explanation: "border-sky-500/30 bg-sky-500/5",
  example: "border-violet-500/30 bg-violet-500/5",
  activity: "border-emerald-500/30 bg-emerald-500/5",
  discussion: "border-amber-500/30 bg-amber-500/5",
  check: "border-rose-500/30 bg-rose-500/5",
  resource_embed: "border-slate-500/30 bg-slate-500/5",
  exit_ticket: "border-teal-500/30 bg-teal-500/5",
};

const BLOCK_LABEL_ACCENT: Record<LessonContentBlockType, string> = {
  explanation: "text-sky-300",
  example: "text-violet-300",
  activity: "text-emerald-300",
  discussion: "text-amber-300",
  check: "text-rose-300",
  resource_embed: "text-slate-300",
  exit_ticket: "text-teal-300",
};

type ContentBlock = {
  id: string;
  type: LessonContentBlockType;
  title: string | null;
  bodyHtml: string;
  order: number;
  estimatedMinutes: number | null;
};

export function StudentSessionContentView({ blocks }: { blocks: ContentBlock[] }) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
        No content has been published for this session yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map((block) => (
        <div
          key={block.id}
          className={cn(
            "rounded-xl border p-5",
            BLOCK_ACCENT[block.type] ?? "border-white/10 bg-white/5"
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                BLOCK_LABEL_ACCENT[block.type] ?? "text-white/60"
              )}
            >
              {LESSON_CONTENT_BLOCK_LABELS[block.type] ?? block.type}
            </span>
            {block.estimatedMinutes != null && block.estimatedMinutes > 0 && (
              <span className="text-xs text-white/40">{block.estimatedMinutes} min</span>
            )}
          </div>

          {block.title && (
            <h3 className="mb-2 text-sm font-semibold text-white">{block.title}</h3>
          )}

          {block.bodyHtml && (
            <div
              className="lesson-content prose prose-sm prose-invert max-w-none text-white/85 [&_a]:text-teal-300 [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:text-sm [&_ol]:pl-5 [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
