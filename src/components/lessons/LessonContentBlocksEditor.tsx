"use client";

import * as React from "react";
import { Check, Loader2, MoveRight, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ADVANCED_LESSON_CONTENT_BLOCK_TYPES,
  LEGACY_LESSON_CONTENT_BLOCK_TYPES,
  LESSON_CONTENT_BLOCK_LABELS,
  LESSON_CONTENT_BLOCK_TYPES,
  isAdvancedLessonBlockType,
  type LessonContentBlock,
  type LessonContentBlockType,
} from "@/types/lesson-content-blocks";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { LessonContentBlocksRenderer } from "@/components/lessons/LessonContentBlocksRenderer";
import { AdvancedBlockEditor } from "@/components/lessons/blocks/LessonBlockEditors";
import { cn } from "@/lib/utils";

export type SessionTarget = { id: string; title: string };

type Props = {
  blocks: LessonContentBlock[];
  onChange: (blocks: LessonContentBlock[]) => void;
  onGenerateWithLeo?: () => Promise<void>;
  leoEnabled?: boolean;
  leoLoading?: boolean;
  readOnly?: boolean;
  schoolId?: string;
  sessionTargets?: SessionTarget[];
  onMoveBlock?: (blockId: string, targetSessionId: string) => void;
};

function newBlock(type: LessonContentBlockType, order: number): LessonContentBlock {
  const base: LessonContentBlock = {
    id: crypto.randomUUID(),
    type,
    title: null,
    bodyHtml: "",
    order,
    estimatedMinutes: null,
    aiGenerated: false,
    teacherReviewed: true,
    resourceUrl: null,
  };

  if (type === "illustration") {
    return {
      ...base,
      assetMeta: {
        assetKind: "illustration",
        assetStatus: "missing",
        required: true,
        source: "teacher",
      },
    };
  }

  if (type === "diagram") {
    return {
      ...base,
      diagramMeta: { diagramType: "fraction_bar", data: { numerator: 1, denominator: 2 } },
      assetMeta: {
        assetKind: "diagram",
        assetStatus: "approved",
        source: "system",
        required: true,
      },
    };
  }

  if (type === "asset_plan") {
    return {
      ...base,
      bodyHtml: "<p>Suggested assets for this lesson.</p>",
      assetMeta: { assetKind: "illustration", assetStatus: "planned", required: false, source: "system" },
    };
  }

  if (type === "math_expression") {
    return {
      ...base,
      mathMeta: { format: "latex", latex: "", plainText: "", validationStatus: "not_checked" },
    };
  }

  if (type === "bilingual_text" || type === "vocabulary" || type === "pronunciation") {
    return {
      ...base,
      languageMeta: {
        requiresLanguageReview: true,
        languageReviewStatus: "needs_review",
        mediumOfInstruction: "bilingual",
      },
    };
  }

  return base;
}

export function LessonContentBlocksEditor({
  blocks,
  onChange,
  onGenerateWithLeo,
  leoEnabled = false,
  leoLoading = false,
  readOnly = false,
  schoolId,
  sessionTargets,
  onMoveBlock,
}: Props) {
  const [preview, setPreview] = React.useState(false);

  const updateBlock = (id: string, patch: Partial<LessonContentBlock>) => {
    onChange(
      blocks.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b, ...patch };
        if (b.aiGenerated && patch.teacherReviewed === undefined) {
          const contentChanged =
            patch.bodyHtml !== undefined ||
            patch.mathMeta !== undefined ||
            patch.languageMeta !== undefined ||
            patch.assetMeta !== undefined ||
            patch.resourceUrl !== undefined;
          if (contentChanged) next.teacherReviewed = false;
        }
        return next;
      }),
    );
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })));
  };

  const addBlock = (type: LessonContentBlockType) => {
    onChange([...blocks, newBlock(type, blocks.length)]);
  };

  const markAllReviewed = () => {
    onChange(
      blocks.map((b) =>
        b.aiGenerated
          ? {
              ...b,
              teacherReviewed: true,
              reviewMeta: { ...b.reviewMeta, aiReviewStatus: "approved" },
            }
          : b,
      ),
    );
  };

  const unreviewed = blocks.filter((b) => b.aiGenerated && !b.teacherReviewed).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/50">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}
          {unreviewed > 0 ? ` · ${unreviewed} AI block${unreviewed === 1 ? "" : "s"} need review` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {leoEnabled && onGenerateWithLeo && !readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={leoLoading}
              onClick={() => void onGenerateWithLeo()}
              className="border-violet-400/30 bg-violet-500/10 text-violet-100"
            >
              {leoLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Generate with Leo
            </Button>
          ) : null}
          {unreviewed > 0 && !readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={markAllReviewed}
              className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Mark all reviewed
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPreview((p) => !p)}
            className="border-white/10 bg-white/5 text-white/70"
          >
            {preview ? "Edit" : "Preview"}
          </Button>
        </div>
      </div>

      {preview ? (
        <LessonContentBlocksRenderer blocks={blocks} viewMode="teacher" />
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <div
              key={block.id}
              className={cn(
                "rounded-xl border p-3",
                block.aiGenerated && !block.teacherReviewed
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-white/10 bg-white/5",
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <PremiumSelect
                  value={block.type}
                  onValueChange={(v) => updateBlock(block.id, { type: v as LessonContentBlockType })}
                  disabled={readOnly}
                >
                  <PremiumSelectTrigger className="h-8 w-[160px]">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {LESSON_CONTENT_BLOCK_TYPES.map((t) => (
                      <PremiumSelectItem key={t} value={t}>
                        {LESSON_CONTENT_BLOCK_LABELS[t]}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
                {block.aiGenerated ? (
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <Checkbox
                      checked={block.teacherReviewed}
                      onCheckedChange={(c) =>
                        updateBlock(block.id, { teacherReviewed: c === true })
                      }
                      disabled={readOnly}
                    />
                    Reviewed
                  </label>
                ) : null}
                {!readOnly && sessionTargets && sessionTargets.length > 0 && onMoveBlock ? (
                  <PremiumDropdownMenu>
                    <PremiumDropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 px-2 text-xs text-white/50 hover:bg-white/10 hover:text-white/80"
                      >
                        <MoveRight className="h-3.5 w-3.5" />
                        Move to
                      </Button>
                    </PremiumDropdownMenuTrigger>
                    <PremiumDropdownMenuContent align="end">
                      {sessionTargets.map((target) => (
                        <PremiumDropdownMenuItem
                          key={target.id}
                          onClick={() => onMoveBlock(block.id, target.id)}
                        >
                          {target.title}
                        </PremiumDropdownMenuItem>
                      ))}
                    </PremiumDropdownMenuContent>
                  </PremiumDropdownMenu>
                ) : null}
                {!readOnly ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="ml-auto h-8 w-8 text-rose-300 hover:bg-rose-500/10"
                    onClick={() => removeBlock(block.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                <Input
                  value={block.title || ""}
                  onChange={(e) => updateBlock(block.id, { title: e.target.value || null })}
                  placeholder="Block title (optional)"
                  disabled={readOnly}
                  className="border-white/10 bg-black/20 text-white"
                />
                {isAdvancedLessonBlockType(block.type) ? (
                  <AdvancedBlockEditor
                    block={block}
                    readOnly={readOnly}
                    schoolId={schoolId}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                ) : (
                  <Textarea
                    value={block.bodyHtml.replace(/<[^>]+>/g, " ").trim()}
                    onChange={(e) =>
                      updateBlock(block.id, {
                        bodyHtml: `<p>${e.target.value.replace(/</g, "&lt;")}</p>`,
                      })
                    }
                    placeholder="Content…"
                    disabled={readOnly}
                    className="min-h-[100px] border-white/10 bg-black/20 text-white"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Label className="w-full text-xs text-white/50">Add block</Label>
            {LEGACY_LESSON_CONTENT_BLOCK_TYPES.slice(0, 4).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addBlock(t)}
                className="border-white/10 bg-white/5 text-xs text-white/70"
              >
                + {LESSON_CONTENT_BLOCK_LABELS[t]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Label className="w-full text-xs text-white/50">Advanced blocks</Label>
            {ADVANCED_LESSON_CONTENT_BLOCK_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addBlock(t)}
                className="border-teal-400/20 bg-teal-500/5 text-xs text-teal-100/90"
              >
                + {LESSON_CONTENT_BLOCK_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
