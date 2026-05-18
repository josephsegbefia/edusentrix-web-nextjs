"use client";

import { useParams } from "next/navigation";
import { SessionTeachingPresenter } from "@/components/lessons/SessionTeachingPresenter";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";

export default function TeacherLessonSessionTeachPage() {
  const params = useParams<{ id: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : null;

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canTeach = can(permissions, PERMISSIONS.lessonTeachingModeManage);

  if (!canTeach) {
    return (
      <Card className="border border-white/10 bg-white/5">
        <CardContent className="p-6 text-sm text-white/60">
          You do not have permission to use teaching mode.
        </CardContent>
      </Card>
    );
  }

  if (!sessionId) {
    return (
      <Card className="border border-rose-500/20 bg-rose-500/10">
        <CardContent className="p-6 text-sm text-rose-100">Invalid session.</CardContent>
      </Card>
    );
  }

  return <SessionTeachingPresenter sessionId={sessionId} />;
}
