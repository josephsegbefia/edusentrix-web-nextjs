"use client";

import * as React from "react";
import type { TeacherListItemDTO } from "@/types/admin/teacher";
import { TeacherCard } from "./TeacherCard";

type TeachersCardGridProps = {
  teachers: TeacherListItemDTO[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onManageAccess?: (id: string) => void;
  onSendMessage?: (id: string) => void;
};

export function TeachersCardGrid({
  teachers,
  onView,
  onEdit,
  onManageAccess,
  onSendMessage,
}: TeachersCardGridProps) {
  if (!teachers.length) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {teachers.map((teacher) => (
        <TeacherCard
          key={teacher.id}
          teacher={teacher}
          onView={onView}
          onEdit={onEdit}
          onManageAccess={onManageAccess}
          onSendMessage={onSendMessage}
        />
      ))}
    </div>
  );
}
