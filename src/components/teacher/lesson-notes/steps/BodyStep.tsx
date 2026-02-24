"use client";

import * as React from "react";
import type { LessonNoteFormData } from "@/types/lesson-notes";
import { isThreePhaseTemplate, isUnitPlannerTemplate } from "@/types/lesson-notes";
import { NaCCA3PhaseEditor } from "./NaCCA3PhaseEditor";
import { ClassicJHSEditor } from "./ClassicJHSEditor";
import { SimpleEditor } from "./SimpleEditor";
import { DynamicPhaseEditor } from "./DynamicPhaseEditor";

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

    case "CAMBRIDGE_3_PART":
    case "BRITISH_3_PART":
    case "AMERICAN_STANDARDS":
      return <DynamicPhaseEditor formData={formData} onUpdate={onUpdate} />;

    case "IB_PYP_UNIT_PLANNER":
    case "IB_MYP_UNIT_PLANNER":
      return <SimpleEditor formData={formData} onUpdate={onUpdate} />;

    case "SIMPLE":
    default:
      return <SimpleEditor formData={formData} onUpdate={onUpdate} />;
  }
}
