"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, NotebookPen, Sparkles } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherJournalPage() {
  const { data: classesData, isLoading } = useTeacherClasses();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.journalView);

  const classEntries = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        studentCount: number;
        subjectIds: Set<string>;
        isHomeroom: boolean;
      }
    >();

    (classesData?.data.classes || []).forEach((item) => {
      if (!item._id) return;
      if (!map.has(item._id)) {
        map.set(item._id, {
          id: item._id,
          name: item.name,
          studentCount: item.studentCount,
          subjectIds: new Set(),
          isHomeroom: item.isHomeroom,
        });
      }

      const entry = map.get(item._id);
      if (!entry) return;
      if (item.subjectId) {
        entry.subjectIds.add(item.subjectId);
      }
      entry.studentCount = Math.max(entry.studentCount, item.studentCount);
      entry.isHomeroom = entry.isHomeroom || item.isHomeroom;
    });

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        subjectCount: entry.subjectIds.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classesData]);

  const stats = React.useMemo(() => {
    return {
      totalClasses: classEntries.length,
      homeroomClasses: classEntries.filter((entry) => entry.isHomeroom).length,
      totalStudents: classEntries.reduce((sum, entry) => sum + entry.studentCount, 0),
      totalSubjects: classEntries.reduce((sum, entry) => sum + entry.subjectCount, 0),
    };
  }, [classEntries]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Class Journal</h1>
          <p className="text-sm text-white/60">Journal access is currently locked.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <FileText className="h-4 w-4" />
              </span>
              Journal access required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to grant journal permissions for your account.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-white/10 bg-linear-to-br from-indigo-500/15 via-white/5 to-cyan-500/10 shadow-2xl shadow-black/35 backdrop-blur">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-3">
            <Badge className="w-fit bg-white/10 text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Teaching continuity
            </Badge>
            <div>
              <h1 className="text-2xl font-semibold text-white">Class Journal</h1>
              <p className="text-sm text-white/65">
                Keep an auditable class-by-class timeline of lessons delivered, reflections, and
                follow-up actions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/10 text-white/80">{stats.totalClasses} classes</Badge>
              <Badge className="bg-cyan-500/20 text-cyan-100">{stats.totalSubjects} subjects</Badge>
              <Badge className="bg-indigo-500/20 text-indigo-100">{stats.totalStudents} students</Badge>
              <Badge className="bg-emerald-500/20 text-emerald-100">
                {stats.homeroomClasses} homeroom
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx} className="border border-white/10 bg-white/5 p-4">
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : classEntries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No classes assigned yet. Once classes are assigned, journals will show here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classEntries.map((entry) => (
            <Card
              key={entry.id}
              className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur transition hover:border-white/20"
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3 text-lg">
                  <div className="space-y-1">
                    <div className="text-white">{entry.name}</div>
                    <div className="text-xs text-white/50">
                      {entry.subjectCount} subjects · {entry.studentCount} students
                    </div>
                  </div>
                  {entry.isHomeroom ? (
                    <Badge className="bg-emerald-500/20 text-emerald-200">Homeroom</Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  Capture what happened in class and keep your record ready for coordination and
                  reporting.
                </div>
                <Button
                  asChild
                  className="w-full bg-indigo-500/25 text-indigo-100 hover:bg-indigo-500/35"
                >
                  <Link href={`/teacher/journal/${entry.id}`}>
                    <NotebookPen className="h-4 w-4" />
                    Open Journal
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
