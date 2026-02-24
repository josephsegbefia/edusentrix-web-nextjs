"use client";

import * as React from "react";
import { Plus, X, Lightbulb } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompactRichText } from "@/components/ui/rich-text-editor";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import type { LessonNoteFormData, CurriculumIndicator } from "@/types/lesson-notes";
import type { CurriculumMetadataField } from "@/constants/curriculum-lesson-templates";
import { getTemplateDefinition } from "@/constants/curriculum-lesson-templates";

type CurriculumStepProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

export function CurriculumStep({ formData, onUpdate }: CurriculumStepProps) {
  const templateDef = getTemplateDefinition(formData.templateType);
  const fields = templateDef?.curriculumFields || [];
  const stepLabel = templateDef?.wizardSteps.find((s) => s.id === "curriculum")?.label || "Curriculum";

  const metadata = formData.curriculumMetadata || {};
  const curriculum = formData.curriculum;

  const updateMetadata = (key: string, value: unknown) => {
    onUpdate({
      curriculumMetadata: { ...metadata, [key]: value },
    });
  };

  const updateCurriculum = (updates: Partial<typeof curriculum>) => {
    onUpdate({ curriculum: { ...curriculum, ...updates } });
  };

  // For NaCCA-style templates, use the legacy curriculum fields for backward compatibility
  const isNaCCAStyle =
    formData.templateType === "NACCA_3_PHASE" ||
    formData.templateType === "CLASSIC_JHS";

  if (isNaCCAStyle) {
    return <NaCCACurriculumFields curriculum={curriculum} updateCurriculum={updateCurriculum} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{stepLabel}</h2>
        <p className="text-sm text-white/60">
          Align your lesson to curriculum standards and objectives
        </p>
      </div>

      {fields.map((field) => (
        <DynamicField
          key={field.key}
          field={field}
          value={metadata[field.key]}
          onChange={(val) => updateMetadata(field.key, val)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Dynamic field renderer for curriculum-specific metadata
// ============================================================================

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: CurriculumMetadataField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label className="text-white/70">
            {field.label}
            {field.required && <span className="text-rose-400 ml-1">*</span>}
          </Label>
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
      );

    case "richtext":
      return (
        <div className="space-y-2">
          <Label className="text-white/70">
            {field.label}
            {field.required && <span className="text-rose-400 ml-1">*</span>}
          </Label>
          <CompactRichText
            value={(value as string) || ""}
            onChange={(val) => onChange(val)}
            placeholder={field.placeholder}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label className="text-white/70">
            {field.label}
            {field.required && <span className="text-rose-400 ml-1">*</span>}
          </Label>
          <PremiumSelect
            value={(value as string) || ""}
            onValueChange={(val) => onChange(val)}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder={field.placeholder} />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {(field.options || []).map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      );

    case "indicator_list":
      return <IndicatorListField field={field} value={value} onChange={onChange} />;

    case "outcome_list":
      return <OutcomeListField field={field} value={value} onChange={onChange} />;

    case "tag_list":
      return <TagListField field={field} value={value} onChange={onChange} />;

    default:
      return null;
  }
}

// ============================================================================
// Indicator list (refNo + text pairs)
// ============================================================================

function IndicatorListField({
  field,
  value,
  onChange,
}: {
  field: CurriculumMetadataField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = (value as CurriculumIndicator[]) || [];

  const add = () => onChange([...items, { refNo: "", text: "" }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx: number, updates: Partial<CurriculumIndicator>) => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], ...updates };
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white/70">{field.label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
          No items added yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start gap-3">
                <div className="w-24 shrink-0">
                  <Input
                    value={item.refNo}
                    onChange={(e) => update(idx, { refNo: e.target.value })}
                    placeholder={field.placeholder}
                    className="border-white/10 bg-white/5 text-white text-xs"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={item.text}
                    onChange={(e) => update(idx, { text: e.target.value })}
                    placeholder="Description"
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(idx)}
                  className="h-9 w-9 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Outcome list (simple string array)
// ============================================================================

function OutcomeListField({
  field,
  value,
  onChange,
}: {
  field: CurriculumMetadataField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = (value as string[]) || [];

  const add = () => onChange([...items, ""]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx: number, val: string) => {
    const copy = [...items];
    copy[idx] = val;
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-white/70">
          <Lightbulb className="h-4 w-4" />
          {field.label}
          {field.required && <span className="text-rose-400">*</span>}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
          No items added yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-200">
                {idx + 1}
              </span>
              <Input
                value={item}
                onChange={(e) => update(idx, e.target.value)}
                placeholder={field.placeholder}
                className="flex-1 border-white/10 bg-white/5 text-white"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(idx)}
                className="h-9 w-9 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tag list (inline tag input)
// ============================================================================

function TagListField({
  field,
  value,
  onChange,
}: {
  field: CurriculumMetadataField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const tags = (value as string[]) || [];
  const [input, setInput] = React.useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };

  const removeTag = (idx: number) => onChange(tags.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <Label className="text-white/70">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={field.placeholder}
          className="flex-1 border-white/10 bg-white/5 text-white"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTag}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="border-white/10 bg-white/5 text-white/70 text-xs gap-1 pr-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Legacy NaCCA curriculum fields (backward compatible)
// ============================================================================

function NaCCACurriculumFields({
  curriculum,
  updateCurriculum,
}: {
  curriculum: LessonNoteFormData["curriculum"];
  updateCurriculum: (updates: Partial<LessonNoteFormData["curriculum"]>) => void;
}) {
  const addIndicator = () => {
    updateCurriculum({
      indicators: [...(curriculum.indicators || []), { refNo: "", text: "" }],
    });
  };

  const updateIndicator = (index: number, updates: Partial<CurriculumIndicator>) => {
    const indicators = [...(curriculum.indicators || [])];
    indicators[index] = { ...indicators[index], ...updates };
    updateCurriculum({ indicators });
  };

  const removeIndicator = (index: number) => {
    updateCurriculum({
      indicators: (curriculum.indicators || []).filter((_, i) => i !== index),
    });
  };

  const addLearningOutcome = () => {
    updateCurriculum({
      learningOutcomes: [...(curriculum.learningOutcomes || []), ""],
    });
  };

  const updateLearningOutcome = (index: number, value: string) => {
    const outcomes = [...(curriculum.learningOutcomes || [])];
    outcomes[index] = value;
    updateCurriculum({ learningOutcomes: outcomes });
  };

  const removeLearningOutcome = (index: number) => {
    updateCurriculum({
      learningOutcomes: (curriculum.learningOutcomes || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Curriculum Alignment</h2>
        <p className="text-sm text-white/60">
          Link your lesson to NaCCA curriculum standards (optional but recommended)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-white/70">Strand</Label>
          <Input
            value={curriculum.strand || ""}
            onChange={(e) => updateCurriculum({ strand: e.target.value })}
            placeholder="e.g., Number"
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Sub-strand</Label>
          <Input
            value={curriculum.subStrand || ""}
            onChange={(e) => updateCurriculum({ subStrand: e.target.value })}
            placeholder="e.g., Fractions"
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-white/70">Content Standard</Label>
        <CompactRichText
          value={curriculum.contentStandard || ""}
          onChange={(value) => updateCurriculum({ contentStandard: value })}
          placeholder="e.g., B4.2.1 Demonstrate understanding of fractions..."
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-white/70">Indicators</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIndicator}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {(curriculum.indicators || []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
            No indicators added. Click &quot;Add&quot; to include curriculum indicators.
          </div>
        ) : (
          <div className="space-y-3">
            {(curriculum.indicators || []).map((indicator, index) => (
              <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start gap-3">
                  <div className="w-24 shrink-0">
                    <Input
                      value={indicator.refNo}
                      onChange={(e) => updateIndicator(index, { refNo: e.target.value })}
                      placeholder="B4.2.1.1"
                      className="border-white/10 bg-white/5 text-white text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      value={indicator.text}
                      onChange={(e) => updateIndicator(index, { text: e.target.value })}
                      placeholder="Indicator description"
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeIndicator(index)}
                    className="h-9 w-9 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-white/70">
            <Lightbulb className="h-4 w-4" />
            Learning Outcomes
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLearningOutcome}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        <p className="text-xs text-white/40">
          What will learners be able to do by the end of this lesson?
        </p>
        {(curriculum.learningOutcomes || []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
            No learning outcomes added yet.
          </div>
        ) : (
          <div className="space-y-2">
            {(curriculum.learningOutcomes || []).map((outcome, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-200">
                  {index + 1}
                </span>
                <Input
                  value={outcome}
                  onChange={(e) => updateLearningOutcome(index, e.target.value)}
                  placeholder="e.g., Learners will be able to identify fractions..."
                  className="flex-1 border-white/10 bg-white/5 text-white"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLearningOutcome(index)}
                  className="h-9 w-9 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
