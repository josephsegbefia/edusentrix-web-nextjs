import type { LessonDiagramMeta, LessonDiagramType } from "@/types/lesson-content-blocks";

export function getDiagramDataNumber(
  data: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const value = data?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function getDiagramDataString(
  data: Record<string, unknown> | undefined,
  key: string,
  fallback = "",
): string {
  const value = data?.[key];
  return typeof value === "string" ? value : fallback;
}

export function isSupportedDiagramType(
  type: LessonDiagramType | undefined,
): type is LessonDiagramType {
  return Boolean(
    type &&
      [
        "fraction_bar",
        "fraction_circle",
        "number_line",
        "angle",
        "simple_shape",
        "flowchart",
        "labelled_process",
      ].includes(type),
  );
}

export function describeDiagram(meta: LessonDiagramMeta | null | undefined): string {
  if (!meta?.diagramType) return "Diagram";
  switch (meta.diagramType) {
    case "fraction_bar":
      return "Fraction bar";
    case "fraction_circle":
      return "Fraction circle";
    case "number_line":
      return "Number line";
    case "angle":
      return "Angle diagram";
    case "simple_shape":
      return "Shape diagram";
    default:
      return "Diagram";
  }
}
