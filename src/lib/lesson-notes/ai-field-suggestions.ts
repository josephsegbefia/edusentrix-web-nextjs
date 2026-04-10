import type { AIFieldBlueprint } from "@/hooks/teacher/useTeacherAIGenerate";
import type { CurriculumMetadataField } from "@/constants/curriculum-lesson-templates";

type SupportedField = AIFieldBlueprint | CurriculumMetadataField;

function toTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|;|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function buildAIFieldBlueprint(
  fields: CurriculumMetadataField[]
): AIFieldBlueprint[] {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options,
  }));
}

export function normalizeAISuggestedFieldValue(
  field: SupportedField,
  value: unknown
): unknown {
  if (value == null) {
    return undefined;
  }

  switch (field.type) {
    case "text":
    case "richtext":
    case "select":
      if (typeof value === "string") {
        return value.trim();
      }
      if (Array.isArray(value)) {
        return value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
          .join(", ");
      }
      return String(value).trim();

    case "outcome_list":
    case "tag_list":
      return toTextArray(value);

    case "indicator_list":
      if (!Array.isArray(value)) {
        return [];
      }
      return value
        .map((item) => {
          if (typeof item === "string") {
            return { refNo: "", text: item.trim() };
          }
          if (!item || typeof item !== "object") {
            return null;
          }
          const refNo =
            "refNo" in item && typeof item.refNo === "string"
              ? item.refNo.trim()
              : "";
          const text =
            "text" in item && typeof item.text === "string"
              ? item.text.trim()
              : "";
          if (!refNo && !text) {
            return null;
          }
          return { refNo, text };
        })
        .filter((item): item is { refNo: string; text: string } => item !== null);

    default:
      return value;
  }
}
