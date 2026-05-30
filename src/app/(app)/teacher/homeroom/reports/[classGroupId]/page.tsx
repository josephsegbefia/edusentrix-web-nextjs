"use client";

import * as React from "react";
import { HomeroomReportsClient } from "@/components/teacher/homeroom/HomeroomReportsClient";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import type { Permission } from "@/lib/rbac";

type TeacherHomeroomReportsClassPageProps = {
  params: Promise<{ classGroupId: string }>;
};

export default function TeacherHomeroomReportsClassPage({
  params,
}: TeacherHomeroomReportsClassPageProps) {
  const { classGroupId } = React.use(params);
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const homeroomClassGroupId = contextData?.data.teacher.homeroomClassGroupId;
  const homeroomClassName = contextData?.data.teacher.homeroomClassName;
  const isHomeroomClass = homeroomClassGroupId === classGroupId;

  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6">
      <HomeroomReportsClient
        classGroupId={classGroupId}
        classLabel={isHomeroomClass ? homeroomClassName : undefined}
        permissions={permissions}
      />
    </div>
  );
}
