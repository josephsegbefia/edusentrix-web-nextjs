"use client";

import Link from "next/link";
import { Archive, ArrowLeft, CalendarDays, FileText } from "lucide-react";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";

export default function TeacherLessonBankPage() {
  return (
    <WorkspacePageShell>
      <WorkspacePageHeader
        icon={<Archive className="h-5 w-5" />}
        title="Lesson bank"
        subtitle="This page has been retired"
        backHref="/teacher/lessons"
        backLabel="Back to Lessons"
      />

      <GlassPanel className="p-8 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Archive className="h-8 w-8 text-white/30" />
        </div>
        <h2 className="text-lg font-medium text-white">Lesson bank has been replaced</h2>
        <p className="text-sm text-white/60 max-w-md mx-auto">
          The lesson bank browsing experience has been retired. Reuse lesson content through
          approved lesson notes and week-plan cloning — these give you timetable-aligned sessions
          with delivery tracking and scheme coverage.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild className="bg-teal-500/20 text-teal-100 hover:bg-teal-500/30">
            <Link href="/teacher/lessons/create">
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Create week plan
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
          >
            <Link href="/teacher/lesson-notes">
              <FileText className="mr-1.5 h-4 w-4" />
              Lesson notes
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="text-white/60 hover:text-white/80"
          >
            <Link href="/teacher/lessons">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to lessons
            </Link>
          </Button>
        </div>
      </GlassPanel>
    </WorkspacePageShell>
  );
}
