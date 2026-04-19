// src/app/(app)/admin/subjects/[subjectId]/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock3,
  Edit,
  ExternalLink,
  Mail,
  MoreHorizontal,
  School,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { useSubjectDetail, useUnassignTeacher, type SubjectDTO } from "@/hooks/admin/useSubjects";
import { useBusyToast } from "@/hooks/useBusyToast";
import { AssignTeacherToSubjectModal } from "@/components/modals/AssignTeacherToSubjectModal";
import { AssignSubjectToClassesModal } from "@/components/modals/AssignSubjectToClassesModal";
import { CreateSubjectModal } from "@/components/modals/CreateSubjectModal";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
}

function SubjectDetailContent() {
  const params = useParams<{ subjectId: string }>();
  const router = useRouter();

  const subjectId = params?.subjectId;
  const busy = useBusyToast();
  const unassignTeacher = useUnassignTeacher(subjectId);
  const [assignTeacherModalOpen, setAssignTeacherModalOpen] = React.useState(false);
  const [assignClassesModalOpen, setAssignClassesModalOpen] = React.useState(false);
  const [editSubjectModalOpen, setEditSubjectModalOpen] = React.useState(false);
  const [editAssignment, setEditAssignment] = React.useState<{
    assignmentId: string;
    teacherId: string;
    classGroupId: string;
    className?: string;
    teacherDisplay?: { firstName: string; lastName: string; fullName: string; email?: string | null; photoUrl?: string | null };
  } | null>(null);
  const [classQuery, setClassQuery] = React.useState("");
  const [teacherQuery, setTeacherQuery] = React.useState("");

  const { data, isLoading, isError } = useSubjectDetail(subjectId);
  const subject = data?.data;

  const gradeBreakdown = React.useMemo(() => {
    const map = new Map<string, number>();
    const classes = subject?.classes ?? [];
    classes.forEach((cls) => {
      const grade = cls.grade?.name || "Uncategorized";
      map.set(grade, (map.get(grade) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [subject?.classes]);

  const filteredClasses = React.useMemo(() => {
    const classes = subject?.classes ?? [];
    const q = classQuery.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((cls) => {
      const gradeName = cls.grade?.name || "";
      return (
        cls.fullLabel.toLowerCase().includes(q) ||
        cls.name.toLowerCase().includes(q) ||
        gradeName.toLowerCase().includes(q)
      );
    });
  }, [subject?.classes, classQuery]);

  const filteredTeachers = React.useMemo(() => {
    const teachers = subject?.teachers ?? [];
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((teacher) => {
      const email = teacher.email || "";
      return (
        teacher.fullName.toLowerCase().includes(q) ||
        teacher.className.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q)
      );
    });
  }, [subject?.teachers, teacherQuery]);

  const teachersPerClass =
    subject && subject.classCount > 0 ? (subject.teacherCount / subject.classCount).toFixed(1) : "0.0";

  const currentPeriodLabel = subject?.currentPeriod
    ? `${subject.currentPeriod.yearLabel} • ${subject.currentPeriod.term}`
    : "No active academic period";

  if (!subjectId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/30 via-slate-950/70 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/15">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <p className="font-semibold text-red-100">Missing subject identifier</p>
                <p className="text-xs text-red-200/70">The subject ID was not provided in the URL.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/subjects")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Subjects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40">
          <CardContent className="p-6 sm:p-8">
            <div className="flex animate-pulse items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-white/10" />
              <div className="space-y-3">
                <div className="h-8 w-56 rounded-lg bg-white/10" />
                <div className="h-4 w-72 rounded bg-white/5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              className="overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/70 to-slate-950/90"
            >
              <CardContent className="p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-8 w-14 animate-pulse rounded bg-white/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !subject) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/30 via-slate-950/70 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/15">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <p className="font-semibold text-red-100">Unable to load subject details</p>
                <p className="text-xs text-red-200/70">
                  The subject might not exist or you might not have access.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/subjects")}
              className="gap-2 rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Subjects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subjectForAssign: SubjectDTO = {
    id: subject.id,
    name: subject.name,
    code: subject.code,
    classCount: subject.classCount,
    teacherCount: subject.teacherCount,
    isActive: subject.isActive,
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
  };

  const statCards = [
    {
      label: "Assigned Classes",
      value: subject.classCount,
      subtitle: `${gradeBreakdown.length} grade level${gradeBreakdown.length === 1 ? "" : "s"}`,
      icon: School,
    },
    {
      label: "Teaching Staff",
      value: subject.teacherCount,
      subtitle: "Teachers with active assignment",
      icon: Users,
    },
    {
      label: "Teachers / Class",
      value: teachersPerClass,
      subtitle: "Average assignment density",
      icon: Sparkles,
    },
    {
      label: "Last Updated",
      value: formatDate(subject.updatedAt),
      subtitle: `Created ${formatDate(subject.createdAt)}`,
      icon: Clock3,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/90 via-slate-950/95 to-black p-5 shadow-2xl shadow-black/40 sm:rounded-3xl sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-linear-to-br from-blue-500/15 via-indigo-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-linear-to-tr from-sky-500/10 via-blue-500/5 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin/subjects")}
              className="mt-0.5 h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {subject.name}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                    subject.isActive
                      ? "border-blue-500/30 bg-blue-500/20 text-blue-300"
                      : "border-slate-500/30 bg-slate-500/20 text-slate-300"
                  )}
                >
                  {subject.isActive ? "Active" : "Inactive"}
                </Badge>
                {subject.code && (
                  <Badge
                    variant="outline"
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70"
                  >
                    {subject.code}
                  </Badge>
                )}
              </div>

              <p className="max-w-2xl text-sm text-white/60">
                Review subject coverage across classes and teaching staff assignments.
              </p>

              <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {currentPeriodLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  Updated {formatDate(subject.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditAssignment(null);
                setAssignTeacherModalOpen(true);
              }}
              className="gap-2 rounded-xl border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign Teacher
            </Button>

            <PremiumDropdownMenu>
              <PremiumDropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PremiumDropdownMenuTrigger>
              <PremiumDropdownMenuContent align="end">
                <PremiumDropdownMenuItem
                  icon={<BookOpen className="h-3.5 w-3.5" />}
                  onClick={() => router.push("/admin/subjects")}
                >
                  All subjects
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuItem
                  icon={<Edit className="h-3.5 w-3.5" />}
                  onClick={() => setEditSubjectModalOpen(true)}
                >
                  Edit subject
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuSeparator />
                <PremiumDropdownMenuItem
                  icon={<School className="h-3.5 w-3.5" />}
                  onClick={() => setAssignClassesModalOpen(true)}
                >
                  Assign to classes
                </PremiumDropdownMenuItem>
                <PremiumDropdownMenuItem
                  icon={<UserPlus className="h-3.5 w-3.5" />}
                  onClick={() => {
                setEditAssignment(null);
                setAssignTeacherModalOpen(true);
              }}
                >
                  Assign teachers
                </PremiumDropdownMenuItem>
              </PremiumDropdownMenuContent>
            </PremiumDropdownMenu>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-xl shadow-black/30"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
                aria-hidden="true"
              />
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">{stat.label}</p>
                    <p className="text-xl font-bold text-white sm:text-2xl">{stat.value}</p>
                    <p className="text-[11px] text-white/45">{stat.subtitle}</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/30">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <School className="h-4 w-4 text-blue-300" />
                  Assigned Classes ({subject.classes.length})
                </CardTitle>
                <p className="mt-1 text-xs text-white/50">
                  Classes currently configured to run this subject.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAssignClassesModalOpen(true)}
                className="gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
              >
                <School className="h-3.5 w-3.5" />
                Assign Class
              </Button>
            </div>

            {gradeBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {gradeBreakdown.map(([grade, count]) => (
                  <span
                    key={grade}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
                  >
                    {grade} ({count})
                  </span>
                ))}
              </div>
            )}

            <div className="relative pt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input
                value={classQuery}
                onChange={(e) => setClassQuery(e.target.value)}
                placeholder="Search class or grade"
                className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-white placeholder:text-white/40 focus:border-blue-500/35 focus:outline-none"
              />
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {filteredClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <School className="h-8 w-8 text-white/25" />
                <p className="mt-2 text-sm text-white/65">
                  {classQuery ? "No classes match your search" : "No class assignments yet"}
                </p>
                {!classQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignClassesModalOpen(true)}
                    className="mt-4 gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10"
                  >
                    <School className="h-3.5 w-3.5" />
                    Assign to Classes
                  </Button>
                )}
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {filteredClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => router.push(`/admin/classes/${cls.id}`)}
                    className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-blue-500/30 hover:bg-blue-500/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200">
                        <School className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{cls.fullLabel}</p>
                        <p className="truncate text-xs text-white/55">{cls.grade?.name || "No grade"}</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-white/35 group-hover:text-white/65" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/30">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Users className="h-4 w-4 text-blue-300" />
                  Teaching Staff ({subject.teacherCount})
                </CardTitle>
                <p className="mt-1 text-xs text-white/50">
                  Teachers actively assigned to this subject.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                setEditAssignment(null);
                setAssignTeacherModalOpen(true);
              }}
                className="gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign Teacher
              </Button>
            </div>

            <div className="relative pt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input
                value={teacherQuery}
                onChange={(e) => setTeacherQuery(e.target.value)}
                placeholder="Search teacher, class, or email"
                className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-white placeholder:text-white/40 focus:border-blue-500/35 focus:outline-none"
              />
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {filteredTeachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users className="h-8 w-8 text-white/25" />
                <p className="mt-2 text-sm text-white/65">
                  {teacherQuery ? "No teachers match your search" : "No teachers assigned yet"}
                </p>
                {!teacherQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                setEditAssignment(null);
                setAssignTeacherModalOpen(true);
              }}
                    className="mt-4 gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Assign Teachers
                  </Button>
                )}
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {filteredTeachers.map((teacher, index) => (
                  <div
                    key={`${teacher.id}-${teacher.classId}-${index}`}
                    className="group flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-blue-500/30 hover:bg-blue-500/10"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/teachers/${teacher.id}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar className="h-9 w-9 shrink-0 border border-white/20">
                        <AvatarImage src={teacher.photoUrl || ""} alt={teacher.fullName} />
                        <AvatarFallback className="bg-linear-to-br from-slate-700 to-slate-800 text-xs font-semibold text-slate-100">
                          {getInitials(teacher.firstName, teacher.lastName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{teacher.fullName}</p>
                        <p className="truncate text-xs text-white/55">{teacher.className}</p>
                        {teacher.email && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-white/45">
                            <Mail className="h-3 w-3" />
                            {teacher.email}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-white/35 group-hover:text-white/65" />
                    </button>

                    <PremiumDropdownMenu>
                      <PremiumDropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PremiumDropdownMenuTrigger>
                      <PremiumDropdownMenuContent align="end">
                        <PremiumDropdownMenuItem
                          icon={<Edit className="h-3.5 w-3.5" />}
                          onClick={() => {
                            setEditAssignment({
                              assignmentId: teacher.assignmentId,
                              teacherId: teacher.id,
                              classGroupId: teacher.classId,
                              className: teacher.className,
                              teacherDisplay: {
                                firstName: teacher.firstName,
                                lastName: teacher.lastName,
                                fullName: teacher.fullName,
                                email: teacher.email,
                                photoUrl: teacher.photoUrl,
                              },
                            });
                            setAssignTeacherModalOpen(true);
                          }}
                        >
                          Edit assignment
                        </PremiumDropdownMenuItem>
                        <PremiumDropdownMenuItem
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Remove ${teacher.fullName} from teaching ${subject?.name} in ${teacher.className}? This will also remove the class from Assigned Classes if no other teacher is assigned.`
                              )
                            )
                              return;
                            try {
                              await busy.promise(
                                unassignTeacher.mutateAsync(teacher.assignmentId),
                                {
                                  loading: "Removing assignment...",
                                  success: "Assignment removed",
                                  error: (e: Error) => e.message || "Failed to remove",
                                }
                              );
                            } catch {
                              // Error handled by busy toast
                            }
                          }}
                          className="text-red-300 focus:text-red-200"
                        >
                          Remove assignment
                        </PremiumDropdownMenuItem>
                      </PremiumDropdownMenuContent>
                    </PremiumDropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <AssignTeacherToSubjectModal
        open={assignTeacherModalOpen}
        onOpenChange={(open) => {
          setAssignTeacherModalOpen(open);
          if (!open) setEditAssignment(null);
        }}
        subject={subjectForAssign}
        editAssignment={editAssignment ?? undefined}
      />

      <CreateSubjectModal
        open={editSubjectModalOpen}
        onOpenChange={setEditSubjectModalOpen}
        subject={subjectForAssign}
      />

      <AssignSubjectToClassesModal
        open={assignClassesModalOpen}
        onOpenChange={setAssignClassesModalOpen}
        subject={subjectForAssign}
      />
    </div>
  );
}

export default function SubjectDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 sm:space-y-8">
          <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40">
            <CardContent className="p-6 sm:p-8">
              <div className="flex animate-pulse items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/10" />
                <div className="space-y-3">
                  <div className="h-8 w-56 rounded-lg bg-white/10" />
                  <div className="h-4 w-72 rounded bg-white/5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <SubjectDetailContent />
    </Suspense>
  );
}
