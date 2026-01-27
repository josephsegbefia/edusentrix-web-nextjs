// src/components/admin/classes/ClassesCardGrid.tsx
"use client";

import * as React from "react";
import { School } from "lucide-react";
import { ClassCard } from "./ClassCard";
import type { ClassGroupDTO } from "@/hooks/admin/useClasses";

type ClassesCardGridProps = {
  classes: ClassGroupDTO[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignHomeroom?: (id: string) => void;
  onAssignSubjects?: (id: string) => void;
};

export function ClassesCardGrid({
  classes,
  onView,
  onEdit,
  onAssignHomeroom,
  onAssignSubjects,
}: ClassesCardGridProps) {
  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <School className="h-8 w-8 text-white/30" />
        </div>
        <p className="mt-4 text-sm font-medium text-white/70">
          No classes found
        </p>
        <p className="mt-1 text-xs text-white/50">
          Create your first class to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {classes.map((classGroup) => (
        <ClassCard
          key={classGroup.id}
          classGroup={classGroup}
          onView={onView}
          onEdit={onEdit}
          onAssignHomeroom={onAssignHomeroom}
          onAssignSubjects={onAssignSubjects}
        />
      ))}
    </div>
  );
}
