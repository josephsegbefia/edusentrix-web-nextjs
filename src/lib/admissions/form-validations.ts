// src/lib/admissions/form-validations.ts
// Pure form-builder validation helpers usable on both server and client.
// They surface integrity issues admins should see *before* publishing
// (duplicates, missing platform requirements, hidden required fields, ...).
//
// We deliberately keep these warnings forward-looking and non-blocking:
// the form save endpoint never rejects on warnings — it just lets the UI
// alert the admin. Hard schema validation still lives in src/schemas/admissions.ts.

import { PLATFORM_REQUIRED_FIELD_KEYS } from "./types";
import type {
  AdmissionDocumentRequirement,
  AdmissionFormField,
  AdmissionFormSchema,
  AdmissionFormSection,
  AdmissionSystemFieldKey,
} from "./types";

export type AdmissionFormIssueSeverity = "error" | "warning" | "info";

export type AdmissionFormIssue = {
  severity: AdmissionFormIssueSeverity;
  /** Stable id useful for keys / dedup. */
  code: string;
  message: string;
  /** Optional pointers so the UI can highlight the offending bit. */
  sectionId?: string;
  fieldId?: string;
  documentId?: string;
};

function pushUnique(list: AdmissionFormIssue[], issue: AdmissionFormIssue) {
  if (list.some((i) => i.code === issue.code)) return;
  list.push(issue);
}

function normaliseLabel(label: string): string {
  return label.trim().toLowerCase();
}

function checkPlatformRequiredFields(schema: AdmissionFormSchema): AdmissionFormIssue[] {
  const issues: AdmissionFormIssue[] = [];
  const presentKeys = new Set<AdmissionSystemFieldKey>();
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.systemFieldKey) presentKeys.add(field.systemFieldKey);
      if (field.isPlatformRequired && field.visible === false) {
        pushUnique(issues, {
          severity: "error",
          code: `hidden-required:${field.id}`,
          sectionId: section.id,
          fieldId: field.id,
          message: `Platform-required question "${field.label}" is hidden. Make it visible.`,
        });
      }
      if (field.isPlatformRequired && field.required === false) {
        pushUnique(issues, {
          severity: "error",
          code: `optional-required:${field.id}`,
          sectionId: section.id,
          fieldId: field.id,
          message: `Platform-required question "${field.label}" must be marked as required.`,
        });
      }
    }
  }
  for (const key of PLATFORM_REQUIRED_FIELD_KEYS) {
    if (!presentKeys.has(key)) {
      pushUnique(issues, {
        severity: "error",
        code: `missing-required:${key}`,
        message: `Required platform field is missing: ${key}. Reset the form or re-add it.`,
      });
    }
  }
  return issues;
}

function checkDuplicateFieldIds(schema: AdmissionFormSchema): AdmissionFormIssue[] {
  const issues: AdmissionFormIssue[] = [];
  const seen = new Map<string, { section: AdmissionFormSection; field: AdmissionFormField }>();
  for (const section of schema.sections) {
    for (const field of section.fields) {
      const previous = seen.get(field.id);
      if (previous) {
        pushUnique(issues, {
          severity: "error",
          code: `duplicate-field-id:${field.id}`,
          fieldId: field.id,
          message: `Two questions share id "${field.id}" (sections "${previous.section.title}" and "${section.title}"). Answers will collide.`,
        });
      } else {
        seen.set(field.id, { section, field });
      }
    }
  }
  return issues;
}

function checkDuplicateLabelsInSection(schema: AdmissionFormSchema): AdmissionFormIssue[] {
  const issues: AdmissionFormIssue[] = [];
  for (const section of schema.sections) {
    const seen = new Map<string, AdmissionFormField>();
    for (const field of section.fields) {
      if (!field.label?.trim()) {
        pushUnique(issues, {
          severity: "warning",
          code: `empty-label:${field.id}`,
          sectionId: section.id,
          fieldId: field.id,
          message: `A question in "${section.title}" is missing a label.`,
        });
        continue;
      }
      const key = normaliseLabel(field.label);
      const dup = seen.get(key);
      if (dup) {
        pushUnique(issues, {
          severity: "warning",
          code: `duplicate-label:${section.id}:${key}`,
          sectionId: section.id,
          fieldId: field.id,
          message: `"${field.label}" appears twice in "${section.title}". Applicants will be confused.`,
        });
      } else {
        seen.set(key, field);
      }
    }
  }
  return issues;
}

function checkSelectOptions(schema: AdmissionFormSchema): AdmissionFormIssue[] {
  const issues: AdmissionFormIssue[] = [];
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.type !== "single_select" && field.type !== "multi_select") continue;
      const options = field.options ?? [];
      if (options.length < 2) {
        pushUnique(issues, {
          severity: "error",
          code: `insufficient-options:${field.id}`,
          sectionId: section.id,
          fieldId: field.id,
          message: `Choice question "${field.label}" needs at least two options.`,
        });
      }
      const seenValues = new Set<string>();
      for (const opt of options) {
        if (!opt.value || !opt.label) {
          pushUnique(issues, {
            severity: "warning",
            code: `empty-option:${field.id}`,
            sectionId: section.id,
            fieldId: field.id,
            message: `One of the choices for "${field.label}" is empty.`,
          });
          continue;
        }
        if (seenValues.has(opt.value)) {
          pushUnique(issues, {
            severity: "error",
            code: `duplicate-option:${field.id}:${opt.value}`,
            sectionId: section.id,
            fieldId: field.id,
            message: `"${field.label}" has two choices with the same id ("${opt.value}").`,
          });
        }
        seenValues.add(opt.value);
      }
    }
  }
  return issues;
}

function checkEmptySections(schema: AdmissionFormSchema): AdmissionFormIssue[] {
  const issues: AdmissionFormIssue[] = [];
  for (const section of schema.sections) {
    if (section.fields.length === 0) {
      pushUnique(issues, {
        severity: "warning",
        code: `empty-section:${section.id}`,
        sectionId: section.id,
        message: `Section "${section.title}" has no questions.`,
      });
    }
  }
  return issues;
}

function checkDocuments(docs: AdmissionDocumentRequirement[]): AdmissionFormIssue[] {
  const issues: AdmissionFormIssue[] = [];
  const seenIds = new Set<string>();
  for (const doc of docs) {
    if (seenIds.has(doc.id)) {
      pushUnique(issues, {
        severity: "error",
        code: `duplicate-document-id:${doc.id}`,
        documentId: doc.id,
        message: `Two document requirements share id "${doc.id}".`,
      });
    }
    seenIds.add(doc.id);
    if (!doc.mimeTypes || doc.mimeTypes.length === 0) {
      pushUnique(issues, {
        severity: "warning",
        code: `no-mime:${doc.id}`,
        documentId: doc.id,
        message: `Document "${doc.label}" accepts any file type. Restrict to PDF/JPG/PNG when possible.`,
      });
    }
    if (!doc.maxSizeMb || doc.maxSizeMb <= 0) {
      pushUnique(issues, {
        severity: "warning",
        code: `no-size:${doc.id}`,
        documentId: doc.id,
        message: `Document "${doc.label}" has no size limit. 5–10 MB is usually enough.`,
      });
    }
  }
  return issues;
}

/**
 * Run all checks and return a flat list of issues, ordered by severity then code.
 */
export function validateAdmissionForm(schema: AdmissionFormSchema): AdmissionFormIssue[] {
  const issues = [
    ...checkPlatformRequiredFields(schema),
    ...checkDuplicateFieldIds(schema),
    ...checkDuplicateLabelsInSection(schema),
    ...checkSelectOptions(schema),
    ...checkEmptySections(schema),
    ...checkDocuments(schema.documentRequirements),
  ];
  const order: Record<AdmissionFormIssueSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  return issues.sort((a, b) => {
    const so = order[a.severity] - order[b.severity];
    return so !== 0 ? so : a.code.localeCompare(b.code);
  });
}

export function summariseFormIssues(issues: AdmissionFormIssue[]): {
  errorCount: number;
  warningCount: number;
  infoCount: number;
} {
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  for (const i of issues) {
    if (i.severity === "error") errorCount++;
    else if (i.severity === "warning") warningCount++;
    else infoCount++;
  }
  return { errorCount, warningCount, infoCount };
}
