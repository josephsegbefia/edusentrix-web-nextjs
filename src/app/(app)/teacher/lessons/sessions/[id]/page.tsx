"use client";

import { useParams } from "next/navigation";
import { TeacherLessonSessionDetail } from "@/components/lessons/TeacherLessonSessionDetail";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";

export default function TeacherLessonSessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : null;

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.lessonsRead);

  if (!canView) {
    return (
      <Card className="border border-white/10 bg-white/5">
        <CardContent className="p-6 text-sm text-white/60">
          You do not have permission to view lesson sessions.
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

  return <TeacherLessonSessionDetail sessionId={sessionId} />;
}
