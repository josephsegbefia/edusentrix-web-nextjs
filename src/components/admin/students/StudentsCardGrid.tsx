"use client";

import * as React from "react";
import type { StudentListItem } from "@/types/admin/student";
import { StudentCard } from "./StudentCard";

type StudentsCardGridProps = {
  students: StudentListItem[];
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignClass?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onRecordPayment?: (id: string) => void;
};

export function StudentsCardGrid({
  students,
  onView,
  onEdit,
  onAssignClass,
  onSendMessage,
  onRecordPayment,
}: StudentsCardGridProps) {
  if (!students.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4">
      {students.map((student) => (
        <StudentCard
          key={student.id}
          student={student}
          onView={onView}
          onEdit={onEdit}
          onAssignClass={onAssignClass}
          onSendMessage={onSendMessage}
          onRecordPayment={onRecordPayment}
        />
      ))}
    </div>
  );
}
