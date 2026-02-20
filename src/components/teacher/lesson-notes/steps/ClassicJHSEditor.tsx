"use client";

import * as React from "react";
import { Plus, X, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompactRichText } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import type {
  LessonNoteFormData,
  ClassicJHSBody,
  ClassicPresentationStep,
} from "@/types/lesson-notes";
import { isClassicJHSBody, DEFAULT_CLASSIC_BODY } from "@/types/lesson-notes";

type ClassicJHSEditorProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

type Section = "objectives" | "rpk" | "intro" | "steps" | "corePoints" | "evaluation" | "remarks";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "objectives", label: "Objectives" },
  { id: "rpk", label: "RPK" },
  { id: "intro", label: "Introduction" },
  { id: "steps", label: "Presentation Steps" },
  { id: "corePoints", label: "Core Points" },
  { id: "evaluation", label: "Evaluation" },
  { id: "remarks", label: "Remarks" },
];

export function ClassicJHSEditor({ formData, onUpdate }: ClassicJHSEditorProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<Section>>(
    new Set(["objectives", "steps"])
  );

  // Get body with proper type
  const body: ClassicJHSBody = isClassicJHSBody(formData.body)
    ? formData.body
    : DEFAULT_CLASSIC_BODY;

  // Update body
  const updateBody = (updates: Partial<ClassicJHSBody>) => {
    onUpdate({
      body: {
        ...body,
        ...updates,
      },
    });
  };

  // Toggle section
  const toggleSection = (section: Section) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Add specific objective
  const addSpecificObjective = () => {
    updateBody({
      objectives: {
        ...body.objectives,
        specific: [...(body.objectives?.specific || []), ""],
      },
    });
  };

  // Update specific objective
  const updateSpecificObjective = (index: number, value: string) => {
    const specific = [...(body.objectives?.specific || [])];
    specific[index] = value;
    updateBody({
      objectives: { ...body.objectives, specific },
    });
  };

  // Remove specific objective
  const removeSpecificObjective = (index: number) => {
    updateBody({
      objectives: {
        ...body.objectives,
        specific: (body.objectives?.specific || []).filter((_, i) => i !== index),
      },
    });
  };

  // Add presentation step
  const addStep = () => {
    const newStep: ClassicPresentationStep = {
      stepTitle: `Step ${(body.presentationSteps?.length || 0) + 1}`,
      teacherActivity: "",
      learnerActivity: "",
      boardWork: "",
      keyQuestions: [],
      timeMins: 10,
    };
    updateBody({
      presentationSteps: [...(body.presentationSteps || []), newStep],
    });
  };

  // Update step
  const updateStep = (index: number, updates: Partial<ClassicPresentationStep>) => {
    const steps = [...(body.presentationSteps || [])];
    steps[index] = { ...steps[index], ...updates };
    updateBody({ presentationSteps: steps });
  };

  // Remove step
  const removeStep = (index: number) => {
    updateBody({
      presentationSteps: (body.presentationSteps || []).filter((_, i) => i !== index),
    });
  };

  // Add core point
  const addCorePoint = () => {
    updateBody({
      corePoints: [...(body.corePoints || []), ""],
    });
  };

  // Update core point
  const updateCorePoint = (index: number, value: string) => {
    const points = [...(body.corePoints || [])];
    points[index] = value;
    updateBody({ corePoints: points });
  };

  // Remove core point
  const removeCorePoint = (index: number) => {
    updateBody({
      corePoints: (body.corePoints || []).filter((_, i) => i !== index),
    });
  };

  // Add evaluation question
  const addQuestion = () => {
    updateBody({
      evaluation: {
        ...body.evaluation,
        questions: [...(body.evaluation?.questions || []), ""],
      },
    });
  };

  // Update question
  const updateQuestion = (index: number, value: string) => {
    const questions = [...(body.evaluation?.questions || [])];
    questions[index] = value;
    updateBody({
      evaluation: { ...body.evaluation, questions },
    });
  };

  // Remove question
  const removeQuestion = (index: number) => {
    updateBody({
      evaluation: {
        ...body.evaluation,
        questions: (body.evaluation?.questions || []).filter((_, i) => i !== index),
      },
    });
  };

  const renderSectionHeader = (section: Section, label: string) => {
    const isExpanded = expandedSections.has(section);
    return (
      <button
        type="button"
        onClick={() => toggleSection(section)}
        className="flex w-full items-center justify-between rounded-t-xl bg-white/5 px-4 py-3 text-left"
      >
        <span className="font-medium text-white">{label}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-white/50" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/50" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Classic JHS Lesson Note</h2>
        <p className="text-sm text-white/60">
          Traditional format with objectives, steps, evaluation, and remarks
        </p>
      </div>

      {/* Objectives */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {renderSectionHeader("objectives", "Objectives")}
        {expandedSections.has("objectives") && (
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label className="text-white/70">General Objective</Label>
              <Input
                value={body.objectives?.general || ""}
                onChange={(e) =>
                  updateBody({
                    objectives: { ...body.objectives, general: e.target.value },
                  })
                }
                placeholder="By the end of the lesson, learners will..."
                className="border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white/70">Specific Objectives</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSpecificObjective}
                  className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {(body.objectives?.specific || []).map((obj, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs text-indigo-200">
                      {index + 1}
                    </span>
                    <Input
                      value={obj}
                      onChange={(e) => updateSpecificObjective(index, e.target.value)}
                      placeholder={`Specific objective ${index + 1}`}
                      className="flex-1 border-white/10 bg-white/5 text-white"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSpecificObjective(index)}
                      className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RPK */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {renderSectionHeader("rpk", "Relevant Previous Knowledge (RPK)")}
        {expandedSections.has("rpk") && (
          <div className="p-4">
            <CompactRichText
              value={body.rpk || ""}
              onChange={(value) => updateBody({ rpk: value })}
              placeholder="What learners should already know..."
            />
          </div>
        )}
      </div>

      {/* Introduction */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {renderSectionHeader("intro", "Introduction")}
        {expandedSections.has("intro") && (
          <div className="p-4">
            <CompactRichText
              value={body.introduction || ""}
              onChange={(value) => updateBody({ introduction: value })}
              placeholder="Hook and lesson purpose..."
            />
          </div>
        )}
      </div>

      {/* Presentation Steps */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {renderSectionHeader("steps", "Presentation Steps")}
        {expandedSections.has("steps") && (
          <div className="p-4 space-y-4">
            {(body.presentationSteps || []).map((step, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-white/30" />
                    <Input
                      value={step.stepTitle}
                      onChange={(e) => updateStep(index, { stepTitle: e.target.value })}
                      className="w-32 border-white/10 bg-white/5 text-white font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={step.timeMins}
                      onChange={(e) =>
                        updateStep(index, { timeMins: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-16 border-white/10 bg-white/5 text-white text-center"
                      min={1}
                      max={60}
                    />
                    <span className="text-xs text-white/50">min</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(index)}
                      className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Teacher Activity</Label>
                    <CompactRichText
                      value={step.teacherActivity}
                      onChange={(value) => updateStep(index, { teacherActivity: value })}
                      placeholder="What the teacher does..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-white/50">Learner Activity</Label>
                    <CompactRichText
                      value={step.learnerActivity}
                      onChange={(value) => updateStep(index, { learnerActivity: value })}
                      placeholder="What learners do..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-white/50">Board Work (optional)</Label>
                  <Input
                    value={step.boardWork || ""}
                    onChange={(e) => updateStep(index, { boardWork: e.target.value })}
                    placeholder="What to write on the board"
                    className="border-white/10 bg-white/5 text-white text-sm"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addStep}
              className="w-full border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Step
            </Button>
          </div>
        )}
      </div>

      {/* Core Points */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {renderSectionHeader("corePoints", "Core Points / Board Summary")}
        {expandedSections.has("corePoints") && (
          <div className="p-4 space-y-2">
            {(body.corePoints || []).map((point, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-white/50">•</span>
                <Input
                  value={point}
                  onChange={(e) => updateCorePoint(index, e.target.value)}
                  placeholder={`Core point ${index + 1}`}
                  className="flex-1 border-white/10 bg-white/5 text-white"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCorePoint(index)}
                  className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCorePoint}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Point
            </Button>
          </div>
        )}
      </div>

      {/* Evaluation */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {renderSectionHeader("evaluation", "Evaluation")}
        {expandedSections.has("evaluation") && (
          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-white/70">Questions</Label>
              {(body.evaluation?.questions || []).map((question, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs text-amber-200">
                    {index + 1}
                  </span>
                  <Input
                    value={question}
                    onChange={(e) => updateQuestion(index, e.target.value)}
                    placeholder={`Question ${index + 1}`}
                    className="flex-1 border-white/10 bg-white/5 text-white"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(index)}
                    className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuestion}
                className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Question
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Marking Notes (optional)</Label>
              <Input
                value={body.evaluation?.markingNotes || ""}
                onChange={(e) =>
                  updateBody({
                    evaluation: { ...body.evaluation, markingNotes: e.target.value },
                  })
                }
                placeholder="Expected answers or marking scheme notes"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Remarks */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {renderSectionHeader("remarks", "Remarks")}
        {expandedSections.has("remarks") && (
          <div className="p-4">
            <CompactRichText
              value={body.remarks || ""}
              onChange={(value) => updateBody({ remarks: value })}
              placeholder="Teacher remarks and follow-up..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
