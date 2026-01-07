// src/components/admin/teachers/TeachersCardGrid.tsx
"use client";

import * as React from "react";
import type { TeacherListItemDTO } from "@/types/admin/teacher";
import { TeacherCard } from "./TeacherCard";

export function TeachersCardGrid({
  teachers,
  selectedIds,
  onToggleSelect,
}: {
  teachers: TeacherListItemDTO[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {teachers.map((t) => (
        <TeacherCard
          key={t.id}
          teacher={t}
          selected={selectedIds.includes(t.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
