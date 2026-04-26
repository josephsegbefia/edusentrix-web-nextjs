// src/lib/admissions/templates.ts
// Cycle templates ("Standard Basic", "Standard SHS") used by
// the CreateCycleModal "Start from a template" flow. A template is a thin
// preset on top of `buildDefaultAdmissionFormSchema()` that:
//
//   1. Optionally tweaks the default form (extra/hidden fields, extra docs).
//   2. Carries sensible cycle-level defaults (waitlist on/off, fee, etc.).
//
// Each template returns a *complete* AdmissionFormSchema so callers can hand
// it straight to AdmissionForm.create(...). Schools can still customise the
// form afterwards.

import {
  buildDefaultAdmissionFormSchema,
  DEFAULT_ACCEPTANCE_TEMPLATE,
  DEFAULT_REJECTION_TEMPLATE,
} from "./defaults";
import type {
  AdmissionDocumentRequirement,
  AdmissionFormField,
  AdmissionFormSchema,
  AdmissionFormSection,
} from "./types";

export type AdmissionCycleTemplateId =
  | "blank"
  | "standard_primary"
  | "standard_shs";

export type AdmissionCycleTemplate = {
  id: AdmissionCycleTemplateId;
  label: string;
  description: string;
  /** Suggested cycle-level defaults; the modal can pre-fill these. */
  defaults: {
    waitlistEnabled: boolean;
    welcomeMessage?: string;
  };
  /** Returns a complete AdmissionFormSchema to seed the cycle. */
  buildSchema: () => AdmissionFormSchema;
};

function appendField(
  schema: AdmissionFormSchema,
  sectionMatcher: (s: AdmissionFormSection) => boolean,
  field: AdmissionFormField
): AdmissionFormSchema {
  const sections = schema.sections.map((section) => {
    if (!sectionMatcher(section)) return section;
    return {
      ...section,
      fields: [
        ...section.fields,
        { ...field, order: section.fields.length },
      ],
    };
  });
  return { ...schema, sections };
}

function appendDocument(
  schema: AdmissionFormSchema,
  doc: AdmissionDocumentRequirement
): AdmissionFormSchema {
  return {
    ...schema,
    documentRequirements: [...schema.documentRequirements, doc],
  };
}

const TEMPLATES: AdmissionCycleTemplate[] = [
  {
    id: "blank",
    label: "Blank cycle",
    description:
      "Just the platform-required fields. Add your own questions in the form builder.",
    defaults: { waitlistEnabled: true },
    buildSchema: () => buildDefaultAdmissionFormSchema(),
  },
  {
    id: "standard_primary",
    label: "Standard Basic",
    description:
      "Primary and JHS intake. Adds language at home, prior-school details and report-card uploads.",
    defaults: {
      waitlistEnabled: true,
      welcomeMessage:
        "Welcome! We're excited that your family is considering us. The application takes about 10 minutes.",
    },
    buildSchema: () => {
      let schema = buildDefaultAdmissionFormSchema();
      schema = appendField(
        schema,
        (s) => s.id === "sec_applicant",
        {
          id: "fld_applicant_languages_at_home",
          label: "Languages spoken at home",
          type: "short_text",
          required: false,
          visible: true,
          order: 0,
          helpText: "Helps us prepare for early literacy and language support.",
        }
      );
      schema = appendField(
        schema,
        (s) => s.id === "sec_applicant",
        {
          id: "fld_applicant_last_school_name",
          label: "Most recent school attended",
          type: "short_text",
          required: false,
          visible: true,
          order: 0,
        }
      );
      schema = appendField(
        schema,
        (s) => s.id === "sec_applicant",
        {
          id: "fld_applicant_last_grade_completed",
          label: "Last grade / class completed",
          type: "short_text",
          required: false,
          visible: true,
          order: 0,
        }
      );
      schema = appendField(
        schema,
        (s) => s.id === "sec_applicant",
        {
          id: "fld_applicant_prior_schooling",
          label: "Has the child attended any prior school?",
          type: "single_select",
          required: false,
          visible: true,
          order: 0,
          options: [
            { value: "no", label: "No" },
            { value: "creche_kg", label: "Crèche or KG" },
            { value: "pre_school", label: "Pre-school" },
            { value: "other", label: "Other" },
          ],
        }
      );
      schema = appendDocument(schema, {
        id: "doc_immunization_card",
        label: "Immunization / vaccination card",
        required: false,
        helpText: "A scan or photo is fine.",
        mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
        maxSizeMb: 5,
      });
      schema = appendDocument(schema, {
        id: "doc_transcript",
        label: "Latest transcript or report card",
        required: false,
        helpText: "PDF preferred. Maximum 10 MB.",
        mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
        maxSizeMb: 10,
      });
      return schema;
    },
  },
  {
    id: "standard_shs",
    label: "Standard SHS",
    description:
      "Senior high intake. Adds intended programme and BECE / equivalent results upload.",
    defaults: {
      waitlistEnabled: true,
      welcomeMessage:
        "Welcome! For SHS applications you'll need a copy of your most recent results (BECE or equivalent).",
    },
    buildSchema: () => {
      let schema = buildDefaultAdmissionFormSchema();
      schema = appendField(
        schema,
        (s) => s.id === "sec_applicant",
        {
          id: "fld_applicant_programme",
          label: "Intended programme of study",
          type: "single_select",
          required: false,
          visible: true,
          order: 0,
          options: [
            { value: "general_science", label: "General science" },
            { value: "general_arts", label: "General arts" },
            { value: "business", label: "Business" },
            { value: "home_economics", label: "Home economics" },
            { value: "visual_arts", label: "Visual arts" },
            { value: "agriculture", label: "Agriculture" },
            { value: "technical", label: "Technical / Vocational" },
          ],
          helpText: "Final placement may differ based on availability.",
        }
      );
      schema = appendDocument(schema, {
        id: "doc_bece_results",
        label: "BECE or equivalent results slip",
        required: true,
        helpText: "Required for SHS placement.",
        mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
        maxSizeMb: 8,
      });
      return schema;
    },
  },
];

export function listAdmissionCycleTemplates(): AdmissionCycleTemplate[] {
  return TEMPLATES;
}

export function getAdmissionCycleTemplate(
  id: string | undefined | null
): AdmissionCycleTemplate | null {
  if (!id) return null;
  const normalizedId = id === "standard_jhs" ? "standard_primary" : id;
  return TEMPLATES.find((t) => t.id === normalizedId) ?? null;
}

export const DEFAULT_ACCEPTANCE_FOR_TEMPLATES = DEFAULT_ACCEPTANCE_TEMPLATE;
export const DEFAULT_REJECTION_FOR_TEMPLATES = DEFAULT_REJECTION_TEMPLATE;
