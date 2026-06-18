"use client";

import * as React from "react";
import { ImagePlus, Loader2, Sparkles, Upload } from "lucide-react";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MathExpressionBlockView } from "@/components/lessons/blocks/MathExpressionBlockView";
import { WorkedExampleBlockView } from "@/components/lessons/blocks/WorkedExampleBlockView";
import { LessonIllustrationPreview } from "@/components/lessons/LessonIllustrationPreview";
import { LessonDiagramView } from "@/components/lessons/diagrams/LessonDiagramView";
import { validateLessonMathLatex } from "@/lib/lessons/katex-utils";
import { uploadFiles } from "@/lib/uploadthing/react";
import { useBusyToast } from "@/hooks/useBusyToast";
import "katex/dist/katex.min.css";

type EditorProps = {
  block: LessonContentBlock;
  onChange: (patch: Partial<LessonContentBlock>) => void;
  readOnly?: boolean;
  schoolId?: string;
};

function patchLanguageMeta(
  block: LessonContentBlock,
  patch: NonNullable<LessonContentBlock["languageMeta"]>,
): Partial<LessonContentBlock> {
  return {
    languageMeta: { ...block.languageMeta, ...patch },
  };
}

function patchMathMeta(
  block: LessonContentBlock,
  patch: NonNullable<LessonContentBlock["mathMeta"]>,
): Partial<LessonContentBlock> {
  const nextLatex = patch.latex ?? block.mathMeta?.latex ?? null;
  const validation = nextLatex ? validateLessonMathLatex(nextLatex) : null;
  return {
    mathMeta: {
      ...block.mathMeta,
      ...patch,
      validationStatus: validation
        ? validation.valid
          ? "valid"
          : "invalid"
        : block.mathMeta?.validationStatus,
      validationMessage: validation?.message ?? block.mathMeta?.validationMessage ?? null,
    },
  };
}

function patchAssetMeta(
  block: LessonContentBlock,
  patch: NonNullable<LessonContentBlock["assetMeta"]>,
): Partial<LessonContentBlock> {
  return {
    assetMeta: { ...block.assetMeta, ...patch },
    accessibilityMeta: {
      ...block.accessibilityMeta,
      altText: patch.altText ?? block.accessibilityMeta?.altText ?? block.assetMeta?.altText,
      caption: patch.caption ?? block.accessibilityMeta?.caption ?? block.assetMeta?.caption,
    },
  };
}

export function LanguageBlockEditor({ block, onChange, readOnly }: EditorProps) {
  const meta = block.languageMeta ?? {};
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-white/55">Language</Label>
          <Input
            value={meta.languageName || ""}
            disabled={readOnly}
            onChange={(e) =>
              onChange(patchLanguageMeta(block, { languageName: e.target.value || undefined }))
            }
            className="border-white/10 bg-black/20 text-white"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-white/55">Dialect / variant</Label>
          <Input
            value={meta.dialectOrVariant || ""}
            disabled={readOnly}
            onChange={(e) =>
              onChange(
                patchLanguageMeta(block, { dialectOrVariant: e.target.value || null }),
              )
            }
            className="border-white/10 bg-black/20 text-white"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-white/55">Primary / support text</Label>
        <Textarea
          value={block.bodyHtml.replace(/<[^>]+>/g, " ").trim()}
          disabled={readOnly}
          onChange={(e) =>
            onChange({
              bodyHtml: `<p>${e.target.value.replace(/</g, "&lt;")}</p>`,
            })
          }
          className="min-h-[90px] border-white/10 bg-black/20 text-white"
        />
      </div>
      {!readOnly ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          onClick={() =>
            onChange({
              ...patchLanguageMeta(block, {
                languageReviewStatus: "approved",
                requiresLanguageReview: false,
                teacherApprovedSpelling: true,
              }),
              teacherReviewed: true,
            })
          }
        >
          Approve language
        </Button>
      ) : null}
    </div>
  );
}

export function MathBlockEditor({ block, onChange, readOnly }: EditorProps) {
  const latex = block.mathMeta?.latex || "";
  const plainText = block.mathMeta?.plainText || "";

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-white/55">Plain explanation</Label>
        <Textarea
          value={plainText}
          disabled={readOnly}
          onChange={(e) =>
            onChange(patchMathMeta(block, { plainText: e.target.value || null }))
          }
          className="min-h-[70px] border-white/10 bg-black/20 text-white"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-white/55">LaTeX expression</Label>
        <Textarea
          value={latex}
          disabled={readOnly}
          onChange={(e) => onChange(patchMathMeta(block, { latex: e.target.value || null }))}
          placeholder="e.g. \\frac{3}{4}"
          className="min-h-[70px] border-white/10 bg-black/20 font-mono text-sm text-white"
        />
      </div>
      {latex ? (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="mb-2 text-xs text-white/45">Preview</p>
          <MathExpressionBlockView block={block} showTeacherWarnings />
        </div>
      ) : null}
    </div>
  );
}

export function WorkedExampleBlockEditor({ block, onChange, readOnly }: EditorProps) {
  const steps = block.mathMeta?.steps ?? [];
  const stepsText = steps
    .map((step, index) => `${index + 1}. ${step.plainText || step.latex || step.title || ""}`)
    .join("\n");

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-white/55">Worked example steps (one per line)</Label>
        <Textarea
          value={stepsText}
          disabled={readOnly}
          onChange={(e) => {
            const nextSteps = e.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, index) => {
                const cleaned = line.replace(/^\d+\.\s*/, "");
                return {
                  title: `Step ${index + 1}`,
                  plainText: cleaned,
                  latex: cleaned.includes("\\") ? cleaned : undefined,
                };
              });
            onChange(patchMathMeta(block, { steps: nextSteps, renderMode: "step" }));
          }}
          className="min-h-[120px] border-white/10 bg-black/20 text-white"
        />
      </div>
      <WorkedExampleBlockView block={block} showTeacherWarnings />
    </div>
  );
}

export function DiagramBlockEditor({ block, onChange, readOnly }: EditorProps) {
  const diagramType = block.diagramMeta?.diagramType || "fraction_bar";
  const numerator = String(
    (block.diagramMeta?.data as { numerator?: number } | undefined)?.numerator ?? 3,
  );
  const denominator = String(
    (block.diagramMeta?.data as { denominator?: number } | undefined)?.denominator ?? 4,
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs text-white/55">Diagram type</Label>
          <Input
            value={diagramType}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                diagramMeta: {
                  ...block.diagramMeta,
                  diagramType: e.target.value as NonNullable<
                    LessonContentBlock["diagramMeta"]
                  >["diagramType"],
                },
                assetMeta: {
                  ...block.assetMeta,
                  assetKind: "diagram",
                  assetStatus: "approved",
                  source: "system",
                },
              })
            }
            className="border-white/10 bg-black/20 text-white"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-white/55">Numerator</Label>
          <Input
            value={numerator}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                diagramMeta: {
                  diagramType: block.diagramMeta?.diagramType || "fraction_bar",
                  data: {
                    ...block.diagramMeta?.data,
                    numerator: Number(e.target.value) || 0,
                    denominator: Number(denominator) || 4,
                  },
                },
              })
            }
            className="border-white/10 bg-black/20 text-white"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-white/55">Denominator</Label>
          <Input
            value={denominator}
            disabled={readOnly}
            onChange={(e) =>
              onChange({
                diagramMeta: {
                  diagramType: block.diagramMeta?.diagramType || "fraction_bar",
                  data: {
                    ...block.diagramMeta?.data,
                    numerator: Number(numerator) || 0,
                    denominator: Number(e.target.value) || 1,
                  },
                },
              })
            }
            className="border-white/10 bg-black/20 text-white"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-white/55">Alt text</Label>
        <Input
          value={block.assetMeta?.altText || ""}
          disabled={readOnly}
          onChange={(e) => onChange(patchAssetMeta(block, { altText: e.target.value || null }))}
          className="border-white/10 bg-black/20 text-white"
        />
      </div>
      <LessonDiagramView
        diagramMeta={block.diagramMeta}
        altText={block.assetMeta?.altText || block.title}
      />
    </div>
  );
}

export function IllustrationBlockEditor({ block, onChange, readOnly, schoolId }: EditorProps) {
  const busyToast = useBusyToast();
  const [generating, setGenerating] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    if (!schoolId) {
      busyToast.error("School context missing for upload.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadFiles("lessonIllustration", {
        files: [file],
        input: schoolId ? { schoolId } : undefined,
      });
      const uploaded = result?.[0];
      const url = uploaded?.serverData?.url || uploaded?.ufsUrl || uploaded?.url;
      const key = uploaded?.serverData?.key || uploaded?.key;
      if (!url) throw new Error("Upload did not return a URL");
      onChange({
        resourceUrl: url,
        ...patchAssetMeta(block, {
          assetKind: "illustration",
          assetStatus: "needs_review",
          source: "teacher",
          required: block.assetMeta?.required ?? true,
          uploadThingKey: key ?? null,
        }),
      });
      busyToast.success("Illustration uploaded.");
    } catch (error) {
      busyToast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const generateAiDraft = async () => {
    const prompt =
      block.assetMeta?.generationPrompt?.trim() ||
      block.title?.trim() ||
      block.bodyHtml.replace(/<[^>]+>/g, " ").trim();
    if (!prompt) {
      busyToast.error("Add a title or description before generating an AI draft.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/leo/lessons/generate-illustration-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, sessionTitle: block.title || "Lesson illustration" }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { imageUrl: string; uploadThingKey?: string };
      };
      if (!res.ok || !json.success || !json.data?.imageUrl) {
        throw new Error(json.error || "Could not generate illustration draft.");
      }
      const uploadKey = json.data.uploadThingKey;
      onChange({
        resourceUrl: json.data.imageUrl,
        ...patchAssetMeta(block, {
          assetKind: "illustration",
          assetStatus: "draft",
          source: "ai",
          required: block.assetMeta?.required ?? true,
          generationPrompt: prompt,
          uploadThingKey: uploadKey ?? null,
        }),
        aiGenerated: true,
        teacherReviewed: false,
      });
      busyToast.success("AI draft generated. Review and approve before publishing.");
    } catch (error) {
      busyToast.error(error instanceof Error ? error.message : "AI draft failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-white/55">Generation prompt / description</Label>
        <Textarea
          value={block.assetMeta?.generationPrompt || block.bodyHtml.replace(/<[^>]+>/g, " ").trim()}
          disabled={readOnly}
          onChange={(e) =>
            onChange({
              bodyHtml: `<p>${e.target.value.replace(/</g, "&lt;")}</p>`,
              ...patchAssetMeta(block, { generationPrompt: e.target.value || null }),
            })
          }
          className="min-h-[70px] border-white/10 bg-black/20 text-white"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-white/55">Caption</Label>
          <Input
            value={block.assetMeta?.caption || ""}
            disabled={readOnly}
            onChange={(e) => onChange(patchAssetMeta(block, { caption: e.target.value || null }))}
            className="border-white/10 bg-black/20 text-white"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-white/55">Alt text (required for publish)</Label>
          <Input
            value={block.assetMeta?.altText || ""}
            disabled={readOnly}
            onChange={(e) => onChange(patchAssetMeta(block, { altText: e.target.value || null }))}
            className="border-white/10 bg-black/20 text-white"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-white/60">
        <Checkbox
          checked={Boolean(block.assetMeta?.required ?? true)}
          disabled={readOnly}
          onCheckedChange={(checked) =>
            onChange(patchAssetMeta(block, { required: checked === true }))
          }
        />
        Required for publish
      </label>
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadImage(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="border-white/10 bg-white/5 text-white/80"
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            Upload image
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={generating}
            onClick={() => void generateAiDraft()}
            className="border-violet-400/30 bg-violet-500/10 text-violet-100"
          >
            {generating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Generate AI draft
          </Button>
          {block.resourceUrl && block.assetMeta?.source === "ai" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onChange({
                  ...patchAssetMeta(block, { assetStatus: "approved" }),
                  teacherReviewed: true,
                })
              }
              className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            >
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
              Approve illustration
            </Button>
          ) : null}
        </div>
      ) : null}
      {block.resourceUrl ? (
        <LessonIllustrationPreview
          src={block.resourceUrl}
          alt={block.assetMeta?.altText || block.title || "Lesson illustration"}
          className="max-w-[280px]"
        />
      ) : null}
    </div>
  );
}

export function AssetPlanBlockEditor({ block, onChange, readOnly }: EditorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-violet-200/75">
        Asset plans are teacher-only checklists. Convert items into diagram or illustration blocks
        when ready.
      </p>
      <Textarea
        value={block.bodyHtml.replace(/<[^>]+>/g, " ").trim()}
        disabled={readOnly}
        onChange={(e) =>
          onChange({
            bodyHtml: `<p>${e.target.value.replace(/</g, "&lt;")}</p>`,
          })
        }
        className="min-h-[90px] border-white/10 bg-black/20 text-white"
      />
    </div>
  );
}

export function AdvancedBlockEditor(props: EditorProps) {
  switch (props.block.type) {
    case "bilingual_text":
    case "vocabulary":
    case "pronunciation":
      return <LanguageBlockEditor {...props} />;
    case "math_expression":
      return <MathBlockEditor {...props} />;
    case "worked_example":
      return <WorkedExampleBlockEditor {...props} />;
    case "diagram":
      return <DiagramBlockEditor {...props} />;
    case "illustration":
      return <IllustrationBlockEditor {...props} />;
    case "asset_plan":
      return <AssetPlanBlockEditor {...props} />;
    default:
      return null;
  }
}
