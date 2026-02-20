"use client";

import * as React from "react";
import { Plus, X, CheckCircle, Home, ClipboardCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CompactRichText } from "@/components/ui/rich-text-editor";
import type { LessonNoteFormData } from "@/types/lesson-notes";

type AssessmentStepProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

export function AssessmentStep({ formData, onUpdate }: AssessmentStepProps) {
  const assessment = formData.assessment;
  const reflections = formData.reflections;

  // Update assessment
  const updateAssessment = (updates: Partial<typeof assessment>) => {
    onUpdate({
      assessment: {
        ...assessment,
        ...updates,
      },
    });
  };

  // Update reflections
  const updateReflections = (updates: Partial<typeof reflections>) => {
    onUpdate({
      reflections: {
        ...reflections,
        ...updates,
      },
    });
  };

  // Add in-class check
  const addInClassCheck = () => {
    updateAssessment({
      inClassChecks: [...(assessment.inClassChecks || []), ""],
    });
  };

  // Update in-class check
  const updateInClassCheck = (index: number, value: string) => {
    const checks = [...(assessment.inClassChecks || [])];
    checks[index] = value;
    updateAssessment({ inClassChecks: checks });
  };

  // Remove in-class check
  const removeInClassCheck = (index: number) => {
    updateAssessment({
      inClassChecks: (assessment.inClassChecks || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Assessment & Reflection</h2>
        <p className="text-sm text-white/60">
          Plan how you'll check understanding and reflect on the lesson
        </p>
      </div>

      {/* In-class Checks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-white/70">
            <CheckCircle className="h-4 w-4" />
            In-class Checks
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInClassCheck}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>

        <p className="text-xs text-white/40">
          Questions or tasks to check understanding during the lesson
        </p>

        {(assessment.inClassChecks || []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
            No in-class checks added. Click "Add" to include questions.
          </div>
        ) : (
          <div className="space-y-2">
            {(assessment.inClassChecks || []).map((check, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-200">
                  {index + 1}
                </span>
                <Input
                  value={check}
                  onChange={(e) => updateInClassCheck(index, e.target.value)}
                  placeholder="e.g., What is 1/4 + 1/4?"
                  className="flex-1 border-white/10 bg-white/5 text-white"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeInClassCheck(index)}
                  className="h-9 w-9 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exit Ticket */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-white/70">
          <ClipboardCheck className="h-4 w-4" />
          Exit Ticket
        </Label>
        <p className="text-xs text-white/40">
          A quick question at the end of the lesson to check understanding
        </p>
        <Input
          value={assessment.exitTicket || ""}
          onChange={(e) => updateAssessment({ exitTicket: e.target.value })}
          placeholder="e.g., Write one thing you learned today"
          className="border-white/10 bg-white/5 text-white"
        />
      </div>

      {/* Homework */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-white/70">
          <Home className="h-4 w-4" />
          Homework / Follow-up
        </Label>
        <CompactRichText
          value={assessment.homework || ""}
          onChange={(value) => updateAssessment({ homework: value })}
          placeholder="Assignment or practice for home..."
        />
      </div>

      {/* Divider */}
      <div className="border-t border-white/10" />

      {/* Reflections */}
      <div className="space-y-4">
        <h3 className="text-md font-medium text-white">Reflections</h3>
        <p className="text-xs text-white/40">
          (To be filled after the lesson)
        </p>

        <div className="space-y-2">
          <Label className="text-white/70">Learner Reflection</Label>
          <CompactRichText
            value={reflections.learner || ""}
            onChange={(value) => updateReflections({ learner: value })}
            placeholder="What did learners understand? What did they struggle with?"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Teacher Reflection</Label>
          <CompactRichText
            value={reflections.teacher || ""}
            onChange={(value) => updateReflections({ teacher: value })}
            placeholder="What worked well? What would you change?"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Link to Next Lesson</Label>
          <Input
            value={reflections.nextLessonLink || ""}
            onChange={(e) => updateReflections({ nextLessonLink: e.target.value })}
            placeholder="How does this connect to the next lesson?"
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
      </div>
    </div>
  );
}
