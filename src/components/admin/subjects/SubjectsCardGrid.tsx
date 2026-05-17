// src/components/admin/subjects/SubjectsCardGrid.tsx
"use client";

import * as React from "react";
import { Shapes } from "lucide-react";
import { SubjectCard } from "./SubjectCard";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";

type SubjectsCardGridProps = {
  subjects: SubjectDTO[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignToClasses?: (id: string) => void;
  onAssignTeachers?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function SubjectsCardGrid({
  subjects,
  onView,
  onEdit,
  onAssignToClasses,
  onAssignTeachers,
  onDelete,
}: SubjectsCardGridProps) {
  if (subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Shapes className="h-8 w-8 text-amber-100/45" />
        </div>
        <p className="mt-4 text-sm font-medium text-white/70">
          No subjects found
        </p>
        <p className="mt-1 text-xs text-white/50">
          Create your first subject to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {subjects.map((subject) => (
        <SubjectCard
          key={subject.id}
          subject={subject}
          onView={onView}
          onEdit={onEdit}
          onAssignToClasses={onAssignToClasses}
          onAssignTeachers={onAssignTeachers}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
