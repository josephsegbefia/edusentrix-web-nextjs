"use client";

import * as React from "react";
import type { GradeDTO } from "@/hooks/admin/useGrades";
import { GradeCard } from "./GradeCard";

type GradesCardGridProps = {
  grades: GradeDTO[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
};

export function GradesCardGrid({
  grades,
  onView,
  onEdit,
}: GradesCardGridProps) {
  if (!grades.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
      {grades.map((grade) => (
        <GradeCard
          key={grade.id}
          grade={grade}
          onView={onView}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
