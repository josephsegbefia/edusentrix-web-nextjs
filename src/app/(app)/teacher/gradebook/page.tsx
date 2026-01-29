"use client";

import * as React from "react";
import { BookOpenCheck } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { GradebookSelector } from "@/components/teacher/gradebook/GradebookSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherGradebookPage() {
  const { data: classesData, isLoading } = useTeacherClasses();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.gradebookView);

  const classes = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        subjects: Array<{ id: string; name: string; studentCount: number }>;
      }
    >();

    (classesData?.data.classes || []).forEach((item) => {
      if (!item._id || !item.subjectId) return;
      if (!map.has(item._id)) {
        map.set(item._id, {
          id: item._id,
          name: item.name,
          subjects: [],
        });
      }
      const entry = map.get(item._id);
      if (!entry) return;
      if (!entry.subjects.some((subject) => subject.id === item.subjectId)) {
        entry.subjects.push({
          id: item.subjectId,
          name: item.subjectName,
          studentCount: item.studentCount,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classesData]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Gradebook</h1>
          <p className="text-sm text-white/60">Record and publish grades once access is enabled.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <BookOpenCheck className="h-4 w-4" />
              </span>
              Gradebook access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Your role doesn&apos;t currently include gradebook permissions. Ask an admin to grant gradebook access.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Gradebook</h1>
        <p className="text-sm text-white/60">
          Jump into a class gradebook to record marks, review totals, and publish results.
        </p>
      </div>

      <GradebookSelector classes={classes} loading={isLoading} />
    </div>
  );
}
