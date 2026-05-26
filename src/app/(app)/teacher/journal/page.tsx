"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, NotebookPen } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { cn } from "@/lib/utils";
import {
  glassInsetClass,
  glassPanelClass,
  glassPrimaryButtonClass,
} from "@/lib/ui/glass-surfaces";

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
      <WorkspacePageShell>
        <WorkspacePageHeader
          icon={FileText}
          title="Class journal"
          subtitle="Keep an auditable class-by-class timeline of lessons and follow-up actions."
        />
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/70">Journal access is currently locked.</p>
          <p className="mt-2 text-xs text-white/50">
            Ask an admin to grant journal permissions for your account.
          </p>
        </GlassPanel>
      </WorkspacePageShell>
    );
  }

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={FileText}
        title="Class journal"
        subtitle="Keep an auditable class-by-class timeline of lessons delivered, reflections, and follow-up actions."
        badge={
          !isLoading ? (
            <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-medium text-teal-200">
              {stats.totalClasses} class{stats.totalClasses === 1 ? "" : "es"}
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge className="border border-cyan-400/20 bg-cyan-500/15 text-cyan-200">
          {stats.totalSubjects} subjects
        </Badge>
        <Badge className="border border-white/10 bg-white/5 text-white/70">
          {stats.totalStudents} students
        </Badge>
        <Badge className="border border-emerald-400/20 bg-emerald-500/15 text-emerald-200">
          {stats.homeroomClasses} homeroom
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx} className={cn(glassPanelClass, "p-4")}>
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : classEntries.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm text-white/60">
            No classes assigned yet. Once classes are assigned, journals will show here.
          </p>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classEntries.map((entry) => (
            <Card
              key={entry.id}
              className={cn(
                glassPanelClass,
                "transition hover:border-white/20 hover:-translate-y-0.5"
              )}
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
                <div className={cn(glassInsetClass, "rounded-2xl p-4 text-sm text-white/60")}>
                  Capture what happened in class and keep your record ready for coordination and
                  reporting.
                </div>
                <Button asChild className={cn("w-full", glassPrimaryButtonClass)}>
                  <Link href={`/teacher/journal/${entry.id}`}>
                    <NotebookPen className="h-4 w-4" />
                    Open journal
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </WorkspacePageShell>
  );
}
