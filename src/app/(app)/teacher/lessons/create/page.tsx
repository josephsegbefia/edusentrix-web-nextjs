"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TeacherLessonWeekCreateWizard } from "@/components/lessons/TeacherLessonWeekCreateWizard";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TeacherLessonWeekCreatePage() {
  const searchParams = useSearchParams();
  const noteId = searchParams.get("noteId")?.trim() || "";
  const classGroupId = searchParams.get("classGroupId")?.trim() || null;

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.lessonsCreate);

  if (!canCreate) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-white">Create weekly lessons</h1>
        <Card className="border border-white/10 bg-white/5">
          <CardContent className="p-6 text-sm text-white/60">
            You do not have permission to create weekly lessons.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!noteId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-white">Create weekly lessons</h1>
        <Card className="border border-amber-500/20 bg-amber-500/10">
          <CardContent className="space-y-4 p-6 text-sm text-amber-100">
            <p>Choose an approved lesson note to start the week creation wizard.</p>
            <Button
              type="button"
              asChild
              variant="outline"
              className="border-white/10 bg-white/5 text-white/80"
            >
              <Link href="/teacher/lesson-notes">Open lesson notes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <TeacherLessonWeekCreateWizard noteId={noteId} initialClassGroupId={classGroupId} />;
}
