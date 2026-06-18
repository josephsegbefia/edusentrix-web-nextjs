"use client";

import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { renderLessonMathLatex } from "@/lib/lessons/katex-utils";
import "katex/dist/katex.min.css";

type Props = {
  block: LessonContentBlock;
  showTeacherWarnings?: boolean;
};

export function WorkedExampleBlockView({ block, showTeacherWarnings = false }: Props) {
  const steps = block.mathMeta?.steps ?? [];

  return (
    <div className="space-y-3">
      {block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/75"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : null}
      {steps.length > 0 ? (
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const rendered = step.latex
              ? renderLessonMathLatex(step.latex, { displayMode: true })
              : null;
            return (
              <li
                key={`${index}-${step.title || "step"}`}
                className="rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-teal-200/80">
                  Step {index + 1}
                  {step.title ? ` · ${step.title}` : ""}
                </p>
                {step.plainText ? (
                  <p className="mt-2 text-sm text-white/75">{step.plainText}</p>
                ) : null}
                {rendered?.html ? (
                  <div
                    className="mt-2 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: rendered.html }}
                  />
                ) : null}
                {step.bodyHtml ? (
                  <div
                    className="prose prose-invert mt-2 max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: step.bodyHtml }}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : block.mathMeta?.latex ? (
        <div
          className="overflow-x-auto rounded-xl border border-white/10 bg-black/25 px-4 py-3"
          dangerouslySetInnerHTML={{
            __html:
              renderLessonMathLatex(block.mathMeta.latex, { displayMode: true }).html || "",
          }}
        />
      ) : null}
      {showTeacherWarnings && block.mathMeta?.validationStatus === "invalid" ? (
        <p className="text-xs text-amber-200/90">
          {block.mathMeta.validationMessage || "Worked example math needs correction."}
        </p>
      ) : null}
    </div>
  );
}
