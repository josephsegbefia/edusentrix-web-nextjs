"use client";

import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { renderLessonMathLatex } from "@/lib/lessons/katex-utils";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";

type Props = {
  block: LessonContentBlock;
  showTeacherWarnings?: boolean;
};

export function MathExpressionBlockView({ block, showTeacherWarnings = false }: Props) {
  const latex = block.mathMeta?.latex?.trim() || "";
  const plainText = block.mathMeta?.plainText?.trim() || "";
  const rendered = latex ? renderLessonMathLatex(latex, { displayMode: true }) : null;

  return (
    <div className="space-y-3">
      {plainText ? <p className="text-sm text-white/70">{plainText}</p> : null}
      {rendered?.html ? (
        <div
          className="overflow-x-auto rounded-xl border border-white/10 bg-black/25 px-4 py-3"
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      ) : plainText ? null : block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/75"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : (
        <p className="text-sm text-white/50">No math expression provided.</p>
      )}
      {showTeacherWarnings && block.mathMeta?.validationStatus === "invalid" ? (
        <p className={cn("text-xs text-amber-200/90")}>
          {block.mathMeta.validationMessage || "Math expression needs correction."}
        </p>
      ) : null}
      {showTeacherWarnings && rendered?.error ? (
        <p className="text-xs text-amber-200/90">{rendered.error}</p>
      ) : null}
    </div>
  );
}
