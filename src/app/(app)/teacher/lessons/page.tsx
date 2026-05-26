"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, BarChart3 } from "lucide-react";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherLessonNotes } from "@/hooks/teacher/useTeacherLessonNotes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { TeacherLessonWeekPlansPanel } from "@/components/lessons/TeacherLessonWeekPlansPanel";

function buildClassLabelMap(
  classes: Array<{
    _id?: string;
    name: string;
    gradeName?: string;
  }>
) {
  const map = new Map<string, string>();
  classes.forEach((c) => {
    if (!c._id) return;
    const label = `${c.gradeName ? c.gradeName + " " : ""}${c.name}`.trim();
    map.set(c._id, label || c.name);
  });
  return map;
}

export default function TeacherLessonsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.lessonsRead);

  const { data: classesData } = useTeacherClasses();
  const classLabelMap = React.useMemo(
    () => buildClassLabelMap(classesData?.data.classes || []),
    [classesData]
  );

  const { data: notesData } = useTeacherLessonNotes({ limit: 100 }, canView);
  const noteOptions = (notesData?.data.entries || []).filter(
    (n) => n.status === "approved",
  );

  React.useEffect(() => {
    if (!canView) return;
    const createFrom = searchParams.get("createFromNote");
    if (!createFrom) return;
    const classParam = searchParams.get("classGroupId");
    const query = classParam
      ? `?noteId=${encodeURIComponent(createFrom)}&classGroupId=${encodeURIComponent(classParam)}`
      : `?noteId=${encodeURIComponent(createFrom)}`;
    router.replace(`/teacher/lessons/create${query}`, { scroll: false });
  }, [canView, searchParams, router]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lessons</h1>
          <p className="text-sm text-white/60">Student lessons are currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardContent className="p-6 text-sm text-white/60">
            Ask an admin to grant journal permissions to create and view lessons.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Lessons</h1>
          <p className="text-sm text-white/60">
            Weekly lesson plans from approved notes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="border-white/15 bg-white/10 text-white/90 hover:bg-white/15"
          >
            <Link href="/teacher/lessons/analytics">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Analytics
            </Link>
          </Button>
          {noteOptions[0] ? (
            <Button
              type="button"
              asChild
              className="group bg-teal-500/20 text-teal-100 hover:bg-teal-500/30"
            >
              <Link href={`/teacher/lessons/create?noteId=${noteOptions[0].id}`}>
                <CalendarDays className="mr-1 h-4 w-4" />
                Weekly lessons
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {noteOptions.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          <p className="font-medium">Approved lesson note required</p>
          <p className="mt-1 text-xs text-amber-100/70">
            Create and get a lesson note approved before building weekly lessons.{" "}
            <Link href="/teacher/lesson-notes" className="underline underline-offset-2">
              Open Lesson Notes
            </Link>
          </p>
        </div>
      )}

      <TeacherLessonWeekPlansPanel classGroupId={null} classLabelMap={classLabelMap} />
    </div>
  );
}
