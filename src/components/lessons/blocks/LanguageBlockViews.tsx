"use client";

import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { Badge } from "@/components/ui/badge";

type Props = {
  block: LessonContentBlock;
  showTeacherWarnings?: boolean;
};

function LanguageReviewBadge({ block }: { block: LessonContentBlock }) {
  const status = block.languageMeta?.languageReviewStatus;
  if (!status || status === "not_required" || status === "approved") return null;
  return (
    <Badge className="border-0 bg-amber-500/15 text-xs text-amber-100">
      Language review required
    </Badge>
  );
}

export function BilingualTextBlockView({ block, showTeacherWarnings = false }: Props) {
  return (
    <div className="space-y-3">
      {showTeacherWarnings ? <LanguageReviewBadge block={block} /> : null}
      {block.languageMeta?.languageName ? (
        <p className="text-xs uppercase tracking-wide text-teal-200/70">
          {block.languageMeta.languageName}
          {block.languageMeta.dialectOrVariant
            ? ` · ${block.languageMeta.dialectOrVariant}`
            : ""}
        </p>
      ) : null}
      {block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/85"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : null}
    </div>
  );
}

export function VocabularyBlockView({ block, showTeacherWarnings = false }: Props) {
  const items = block.languageMeta?.vocabularyItems ?? [];
  return (
    <div className="space-y-3">
      {showTeacherWarnings ? <LanguageReviewBadge block={block} /> : null}
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.word}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
            >
              <p className="font-medium text-white/90">{item.word}</p>
              {item.meaningEnglish ? (
                <p className="text-sm text-white/65">{item.meaningEnglish}</p>
              ) : null}
              {item.pronunciationHint ? (
                <p className="text-xs text-teal-200/70">{item.pronunciationHint}</p>
              ) : null}
              {item.exampleSentence ? (
                <p className="mt-1 text-xs text-white/50">{item.exampleSentence}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/75"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : (
        <p className="text-sm text-white/50">No vocabulary items yet.</p>
      )}
    </div>
  );
}

export function PronunciationBlockView({ block, showTeacherWarnings = false }: Props) {
  return (
    <div className="space-y-3">
      {showTeacherWarnings ? <LanguageReviewBadge block={block} /> : null}
      {block.bodyHtml ? (
        <div
          className="prose prose-invert max-w-none text-sm text-white/75"
          dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
        />
      ) : null}
      {block.resourceUrl ? (
        <audio controls src={block.resourceUrl} className="w-full max-w-md" />
      ) : null}
    </div>
  );
}
