"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { RichTextEditor, CompactRichText } from "@/components/ui/rich-text-editor";
import type { LessonNoteFormData, SimpleBody } from "@/types/lesson-notes";
import { isSimpleBody, DEFAULT_SIMPLE_BODY } from "@/types/lesson-notes";

type SimpleEditorProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

export function SimpleEditor({ formData, onUpdate }: SimpleEditorProps) {
  // Get body with proper type
  const body: SimpleBody = isSimpleBody(formData.body)
    ? formData.body
    : DEFAULT_SIMPLE_BODY;

  // Update body
  const updateBody = (updates: Partial<SimpleBody>) => {
    onUpdate({
      body: {
        ...body,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Quick Lesson Note</h2>
        <p className="text-sm text-white/60">
          Simple format for quick lesson planning
        </p>
      </div>

      {/* Objectives */}
      <div className="space-y-2">
        <Label className="text-white/70">Learning Objectives</Label>
        <CompactRichText
          value={body.objectives || ""}
          onChange={(value) => updateBody({ objectives: value })}
          placeholder="What will learners be able to do by the end of this lesson?"
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label className="text-white/70">Lesson Content</Label>
        <RichTextEditor
          value={body.content || ""}
          onChange={(value) => updateBody({ content: value })}
          placeholder="Describe the lesson activities, key points, and teaching strategies..."
          minHeight="200px"
          maxHeight="500px"
          toolbarVariant="full"
        />
        <p className="text-xs text-white/40">
          You can include activities, explanations, questions, and any other notes.
        </p>
      </div>
    </div>
  );
}
