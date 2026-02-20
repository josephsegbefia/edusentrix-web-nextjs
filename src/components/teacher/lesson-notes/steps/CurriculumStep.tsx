"use client";

import * as React from "react";
import { Plus, X, Lightbulb } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompactRichText } from "@/components/ui/rich-text-editor";
import type { LessonNoteFormData, CurriculumIndicator } from "@/types/lesson-notes";

type CurriculumStepProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

export function CurriculumStep({ formData, onUpdate }: CurriculumStepProps) {
  const curriculum = formData.curriculum;

  const updateCurriculum = (updates: Partial<typeof curriculum>) => {
    onUpdate({
      curriculum: {
        ...curriculum,
        ...updates,
      },
    });
  };

  // Add indicator
  const addIndicator = () => {
    const newIndicator: CurriculumIndicator = { refNo: "", text: "" };
    updateCurriculum({
      indicators: [...(curriculum.indicators || []), newIndicator],
    });
  };

  // Update indicator
  const updateIndicator = (index: number, updates: Partial<CurriculumIndicator>) => {
    const indicators = [...(curriculum.indicators || [])];
    indicators[index] = { ...indicators[index], ...updates };
    updateCurriculum({ indicators });
  };

  // Remove indicator
  const removeIndicator = (index: number) => {
    const indicators = (curriculum.indicators || []).filter((_, i) => i !== index);
    updateCurriculum({ indicators });
  };

  // Add learning outcome
  const addLearningOutcome = () => {
    updateCurriculum({
      learningOutcomes: [...(curriculum.learningOutcomes || []), ""],
    });
  };

  // Update learning outcome
  const updateLearningOutcome = (index: number, value: string) => {
    const outcomes = [...(curriculum.learningOutcomes || [])];
    outcomes[index] = value;
    updateCurriculum({ learningOutcomes: outcomes });
  };

  // Remove learning outcome
  const removeLearningOutcome = (index: number) => {
    const outcomes = (curriculum.learningOutcomes || []).filter((_, i) => i !== index);
    updateCurriculum({ learningOutcomes: outcomes });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Curriculum Alignment</h2>
        <p className="text-sm text-white/60">
          Link your lesson to NaCCA curriculum standards (optional but recommended)
        </p>
      </div>

      {/* Strand & Sub-strand */}
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

      {/* Content Standard */}
      <div className="space-y-2">
        <Label className="text-white/70">Content Standard</Label>
        <CompactRichText
          value={curriculum.contentStandard || ""}
          onChange={(value) => updateCurriculum({ contentStandard: value })}
          placeholder="e.g., B4.2.1 Demonstrate understanding of fractions..."
        />
      </div>

      {/* Indicators */}
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
            No indicators added. Click "Add" to include curriculum indicators.
          </div>
        ) : (
          <div className="space-y-3">
            {(curriculum.indicators || []).map((indicator, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-24 flex-shrink-0">
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

      {/* Learning Outcomes */}
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
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-200">
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
