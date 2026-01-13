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
  Sparkles,
  Edit,
  MoreHorizontal,
  School,
  Users,
  UserPlus,
  ExternalLink,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useSubjectDetail } from "@/hooks/admin/useSubjects";

function SubjectDetailContent() {
  const params = useParams<{ subjectId: string }>();
  const router = useRouter();

  const subjectId = params?.subjectId;

  const { data, isLoading, isError } = useSubjectDetail(subjectId);
  const subject = data?.data;

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  if (!subjectId) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Missing subject identifier
                </div>
                <p className="text-xs text-red-200/70">
                  The subject ID was not provided in the URL.
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-start gap-4">
            <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
            <div className="space-y-2">
              <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
              <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-rose-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="flex animate-pulse flex-col gap-6 p-8">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-2xl bg-white/10" />
              <div className="space-y-3">
                <div className="h-8 w-48 rounded bg-white/15" />
                <div className="h-5 w-24 rounded-full bg-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !subject) {
    return (
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 via-slate-950/60 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardContent className="relative z-10 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-300" />
              </div>
              <div>
                <div className="font-semibold text-red-100">
                  Unable to load subject details
                </div>
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-pink-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin/subjects")}
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-white/5 transition-all duration-200 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="bg-gradient-to-r from-rose-200 via-pink-200 to-fuchsia-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Subject Details
                </h1>
                {subject.isActive && (
                  <div className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                    <Sparkles className="h-3 w-3" />
                    Active
                  </div>
                )}
              </div>
              <p className="text-sm text-white/60">
                View subject information, assigned classes, and teachers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/subjects")}
              className="gap-2 rounded-xl border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <BookOpen className="h-3.5 w-3.5" />
              All Subjects
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[160px] border border-white/10 bg-slate-900/95 text-xs text-slate-50 backdrop-blur-xl"
              >
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <Edit className="h-3.5 w-3.5" />
                  Edit Subject
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <School className="h-3.5 w-3.5" />
                  Assign to Classes
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2">
                  <UserPlus className="h-3.5 w-3.5" />
                  Assign Teachers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Subject Header Card */}
      <Card className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-rose-500/15 via-pink-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardContent className="relative z-10 p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            {/* Left: Icon + Info */}
            <div className="flex flex-1 items-start gap-6">
              <div className="relative shrink-0">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-white/20 bg-gradient-to-br from-rose-500/30 to-pink-600/30 shadow-2xl shadow-black/50 ring-4 ring-rose-500/20">
                  <BookOpen className="h-10 w-10 text-rose-200" />
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                      {subject.name}
                    </h1>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-semibold",
                        subject.isActive
                          ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                          : "border-slate-500/40 bg-slate-500/15 text-slate-300"
                      )}
                    >
                      {subject.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {subject.code && (
                    <p className="text-sm text-white/60">Code: {subject.code}</p>
                  )}
                </div>

                {subject.currentPeriod && (
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {subject.currentPeriod.yearLabel} - {subject.currentPeriod.term}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Stats */}
            <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <School className="h-5 w-5 text-rose-400" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {subject.classCount}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">
                    Classes
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <Users className="h-5 w-5 text-purple-400" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {subject.teacherCount}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">
                    Teachers
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Classes Card */}
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <School className="h-4 w-4 text-rose-400" />
              Assigned Classes ({subject.classes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {subject.classes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <School className="h-8 w-8 text-white/20" />
                <p className="mt-2 text-sm text-white/50">
                  Not assigned to any classes
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2 border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10"
                >
                  <School className="h-3.5 w-3.5" />
                  Assign to Classes
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {subject.classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => router.push(`/admin/classes/${cls.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-rose-500/30 hover:bg-rose-500/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20">
                        <School className="h-4 w-4 text-rose-300" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{cls.fullLabel}</p>
                        {cls.grade && (
                          <p className="text-xs text-white/50">{cls.grade.name}</p>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-white/40" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teachers Card */}
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <Users className="h-4 w-4 text-purple-400" />
              Teaching Staff ({subject.teacherCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {subject.teachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Users className="h-8 w-8 text-white/20" />
                <p className="mt-2 text-sm text-white/50">No teachers assigned</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2 border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Assign Teachers
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {subject.teachers.map((teacher, idx) => (
                  <button
                    key={`${teacher.id}-${teacher.classId}-${idx}`}
                    onClick={() => router.push(`/admin/teachers/${teacher.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-purple-500/30 hover:bg-purple-500/5"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-white/20">
                        <AvatarImage
                          src={teacher.photoUrl || ""}
                          alt={teacher.fullName}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-purple-600 to-violet-700 text-xs font-semibold text-white">
                          {getInitials(teacher.firstName, teacher.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">{teacher.fullName}</p>
                        <p className="text-xs text-white/50">{teacher.className}</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-white/40" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SubjectDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="relative">
            <div
              className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative z-10 flex items-start gap-4">
              <div className="h-10 w-10 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              <div className="space-y-2">
                <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
                <div className="h-4 w-96 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <SubjectDetailContent />
    </Suspense>
  );
}
