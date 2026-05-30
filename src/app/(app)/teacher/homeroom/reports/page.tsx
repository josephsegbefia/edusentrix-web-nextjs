"use client";

import { HomeroomReportsClient } from "@/components/teacher/homeroom/HomeroomReportsClient";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import type { Permission } from "@/lib/rbac";

export default function TeacherHomeroomReportsPage() {
  const { data: contextData } = useTeacherContext();
  const teacher = contextData?.data.teacher;
  const permissions = contextData?.data.permissions as Permission[] | undefined;

  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
      <HomeroomReportsClient
        classGroupId={teacher?.homeroomClassGroupId}
        classLabel={teacher?.homeroomClassName}
        permissions={permissions}
      />
    </div>
  );
}
