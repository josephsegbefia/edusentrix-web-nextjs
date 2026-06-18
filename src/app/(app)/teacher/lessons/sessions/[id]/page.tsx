"use client";

import { useParams } from "next/navigation";
import { TeacherLessonSessionDetail } from "@/components/lessons/TeacherLessonSessionDetail";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function TeacherLessonSessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = typeof params?.id === "string" ? params.id : null;

  const { data: contextData, isLoading, isError } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.lessonsRead);

  if (isLoading) {
    return (
      <Card className="border border-white/10 bg-white/5">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading teacher access...
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-amber-500/20 bg-amber-500/10">
        <CardContent className="p-6 text-sm text-amber-100">
          Your teacher session could not be verified. Please refresh or sign in again.
        </CardContent>
      </Card>
    );
  }

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
