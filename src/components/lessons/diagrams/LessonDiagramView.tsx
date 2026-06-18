"use client";

import type { LessonDiagramMeta } from "@/types/lesson-content-blocks";
import { isSupportedDiagramType } from "@/lib/lessons/diagrams";
import { FractionBarDiagram } from "@/components/lessons/diagrams/FractionBarDiagram";
import { NumberLineDiagram } from "@/components/lessons/diagrams/NumberLineDiagram";
import { AngleDiagram } from "@/components/lessons/diagrams/AngleDiagram";
import { SimpleShapeDiagram } from "@/components/lessons/diagrams/SimpleShapeDiagram";
import { cn } from "@/lib/utils";

type Props = {
  diagramMeta?: LessonDiagramMeta | null;
  altText?: string | null;
  className?: string;
};

export function LessonDiagramView({ diagramMeta, altText, className }: Props) {
  const type = diagramMeta?.diagramType;
  const data = diagramMeta?.data;

  if (!isSupportedDiagramType(type)) {
    return (
      <p className="text-sm text-amber-200/80">
        Diagram data is missing or not supported yet.
      </p>
    );
  }

  const diagram = (() => {
    switch (type) {
      case "fraction_bar":
      case "fraction_circle":
        return <FractionBarDiagram data={data} className="h-auto w-full max-w-md" />;
      case "number_line":
        return <NumberLineDiagram data={data} className="h-auto w-full max-w-md" />;
      case "angle":
        return <AngleDiagram data={data} className="h-auto w-full max-w-md" />;
      case "simple_shape":
      case "flowchart":
      case "labelled_process":
        return <SimpleShapeDiagram data={data} className="h-auto w-full max-w-md" />;
      default:
        return null;
    }
  })();

  return (
    <figure className={cn("rounded-xl border border-white/10 bg-black/20 p-4", className)}>
      {diagram}
      {altText ? (
        <figcaption className="mt-2 text-xs text-white/50">{altText}</figcaption>
      ) : null}
    </figure>
  );
}
