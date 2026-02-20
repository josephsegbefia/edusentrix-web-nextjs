"use client";

import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  FolderKanban,
  Layers,
  ListChecks,
  PenSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

const quickLinks = [
  {
    title: "Assignments",
    description: "Create and manage graded work.",
    href: "/teacher/studio/assignments",
    icon: ClipboardCheck,
  },
  {
    title: "Quizzes",
    description: "Build and run quiz-based assessments.",
    href: "/teacher/studio/quizzes",
    icon: ListChecks,
  },
  {
    title: "Submissions",
    description: "Review and mark student submissions.",
    href: "/teacher/studio/submissions",
    icon: FolderKanban,
  },
  {
    title: "Rubrics",
    description: "Build reusable marking rubrics.",
    href: "/teacher/studio/rubrics",
    icon: Layers,
  },
  {
    title: "Resources",
    description: "Organize lesson assets and links.",
    href: "/teacher/studio/resources",
    icon: FileText,
  },
];

export default function TeacherStudioPage() {
  const { data } = useTeacherContext();
  const permissions = data?.data.permissions as Permission[] | undefined;
  const canCreate = can(permissions, PERMISSIONS.assignmentsCreate);
  const canGrade = can(permissions, PERMISSIONS.assignmentsGrade);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-white/40">
          <PenSquare className="h-4 w-4" />
          Teacher Studio
        </div>
        <h1 className="text-3xl font-semibold text-white">Create, track, and grade with confidence.</h1>
        <p className="max-w-2xl text-sm text-white/60">
          Build assignments and quizzes, manage submissions, and publish results using
          the premium teacher workflow.
        </p>
        {canCreate && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 sm:w-auto">
              <Link href="/teacher/studio/assignments/new">Create assignment</Link>
            </Button>
            <Button asChild className="w-full border border-white/10 bg-white/10 text-white hover:bg-white/20 sm:w-auto">
              <Link href="/teacher/studio/quizzes/new">Create quiz</Link>
            </Button>
          </div>
        )}
        {!canCreate && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            You can browse Studio content, but assignment creation is not enabled for your role.
          </div>
        )}
        {!canGrade && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Grading tools are locked. Ask an admin to grant grading permissions if needed.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="group">
              <Card className="h-full border border-white/10 bg-linear-to-br from-white/5 to-transparent transition group-hover:-translate-y-0.5 group-hover:bg-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg text-white">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70">
                      <Icon className="h-4 w-4" />
                    </span>
                    {link.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/60">
                  {link.description}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
