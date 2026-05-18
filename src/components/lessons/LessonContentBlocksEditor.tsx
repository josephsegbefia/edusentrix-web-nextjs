"use client";

import * as React from "react";
import { Check, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LESSON_CONTENT_BLOCK_LABELS,
  LESSON_CONTENT_BLOCK_TYPES,
  type LessonContentBlock,
  type LessonContentBlockType,
} from "@/types/lesson-content-blocks";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { LessonContentBlocksRenderer } from "@/components/lessons/LessonContentBlocksRenderer";
import { cn } from "@/lib/utils";

type Props = {
  blocks: LessonContentBlock[];
  onChange: (blocks: LessonContentBlock[]) => void;
  onGenerateWithLeo?: () => Promise<void>;
  leoEnabled?: boolean;
  leoLoading?: boolean;
  readOnly?: boolean;
};

function newBlock(type: LessonContentBlockType, order: number): LessonContentBlock {
  return {
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
}

export function LessonContentBlocksEditor({
  blocks,
  onChange,
  onGenerateWithLeo,
  leoEnabled = false,
  leoLoading = false,
  readOnly = false,
}: Props) {
  const [preview, setPreview] = React.useState(false);

  const updateBlock = (id: string, patch: Partial<LessonContentBlock>) => {
    onChange(
      blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              ...patch,
              teacherReviewed: patch.teacherReviewed ?? (b.aiGenerated ? patch.bodyHtml !== undefined ? false : b.teacherReviewed : b.teacherReviewed),
            }
          : b,
      ),
    );
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })));
  };

  const addBlock = (type: LessonContentBlockType) => {
    onChange([...blocks, newBlock(type, blocks.length)]);
  };

  const markAllReviewed = () => {
    onChange(blocks.map((b) => (b.aiGenerated ? { ...b, teacherReviewed: true } : b)));
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
        <LessonContentBlocksRenderer blocks={blocks} />
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
                  <PremiumSelectTrigger className="h-8 w-[140px]">
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
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Label className="w-full text-xs text-white/50">Add block</Label>
          {LESSON_CONTENT_BLOCK_TYPES.slice(0, 4).map((t) => (
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
      ) : null}
    </div>
  );
}
