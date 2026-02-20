"use client";

import * as React from "react";
import type { LessonNoteFormData } from "@/types/lesson-notes";
import { NaCCA3PhaseEditor } from "./NaCCA3PhaseEditor";
import { ClassicJHSEditor } from "./ClassicJHSEditor";
import { SimpleEditor } from "./SimpleEditor";

type BodyStepProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

export function BodyStep({ formData, onUpdate }: BodyStepProps) {
  switch (formData.templateType) {
    case "NACCA_3_PHASE":
      return <NaCCA3PhaseEditor formData={formData} onUpdate={onUpdate} />;
    case "CLASSIC_JHS":
      return <ClassicJHSEditor formData={formData} onUpdate={onUpdate} />;
    case "SIMPLE":
    default:
      return <SimpleEditor formData={formData} onUpdate={onUpdate} />;
  }
}
