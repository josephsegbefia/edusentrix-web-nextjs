"use client";

import Link from "next/link";
import { FileText, NotebookPen } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

export default function TeacherJournalPage() {
  const { data: classesData, isLoading } = useTeacherClasses();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.journalView);

  const classEntries = new Map<
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
    if (!classEntries.has(item._id)) {
      classEntries.set(item._id, {
        id: item._id,
        name: item.name,
        studentCount: item.studentCount,
        subjectIds: new Set(),
        isHomeroom: item.isHomeroom,
      });
    }
    const entry = classEntries.get(item._id);
    if (!entry) return;
    if (item.subjectId) {
      entry.subjectIds.add(item.subjectId);
    }
    entry.studentCount = Math.max(entry.studentCount, item.studentCount);
    entry.isHomeroom = entry.isHomeroom || item.isHomeroom;
  });

  const classes = Array.from(classEntries.values())
    .map((entry) => ({
      ...entry,
      subjectCount: entry.subjectIds.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Class Journal</h1>
        <p className="text-sm text-white/60">
          Capture lesson notes, homework reminders, and reflections for each class.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No classes assigned yet. Once classes are assigned, journals will show here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((entry) => (
            <Card
              key={entry.id}
              className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-3 text-lg">
                  <div>
                    <div className="text-white">{entry.name}</div>
                    <div className="mt-1 text-xs text-white/50">
                      {entry.subjectCount} subjects · {entry.studentCount} students
                    </div>
                  </div>
                  {entry.isHomeroom && (
                    <Badge className="bg-emerald-500/20 text-emerald-200">Homeroom</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  Keep a running log of lessons, assignments, and classroom notes.
                </div>
                <Button
                  asChild
                  className="w-full bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
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
