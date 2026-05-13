"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Calendar,
  Layers3,
  School,
  Sparkles,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SubjectOfferingDetail = {
  id: string;
  subjectFamily: string;
  displayName: string;
  shortName: string;
  code: string;
  curriculumCode: string;
  stage: string;
  gradeBand: string;
  category: string;
  lessonNoteTemplateVariant: string | null;
  reportCardGroup: string | null;
  isActive: boolean;
  grades: Array<{ id: string; name: string; code: string | null; stage: string | null }>;
  classes: Array<{
    id: string;
    name: string;
    fullLabel: string;
    grade: { id: string; name: string; code: string | null } | null;
    isActive: boolean;
  }>;
  teachers: Array<{
    assignmentId: string;
    id: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
    classGroupId: string | null;
    classGroupName: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

function pretty(value?: string | null) {
  return value ? value.replace(/_/g, " ") : "Not set";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function useSubjectOfferingDetail(id?: string) {
  return useQuery<{ success: boolean; data: SubjectOfferingDetail }>({
    queryKey: ["subject-offering", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/admin/subject-offerings/${id}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load subject offering");
      return json;
    },
  });
}

export default function SubjectOfferingDetailPage() {
  const params = useParams<{ subjectId: string }>();
  const router = useRouter();
  const subjectOfferingId = params?.subjectId;
  const { data, isLoading, isError } = useSubjectOfferingDetail(subjectOfferingId);
  const offering = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !offering) {
    return (
      <Card className="border-red-500/25 bg-red-950/20 text-white">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-red-100">Unable to load subject offering</p>
            <p className="text-sm text-red-100/60">The offering may not exist or may belong to another school.</p>
          </div>
          <Button onClick={() => router.push("/admin/subjects")} variant="outline">
            Back to offerings
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    {
      label: "Grade Coverage",
      value: offering.grades.length,
      helper: offering.grades.map((grade) => grade.name).join(", ") || "No grades assigned",
      icon: Layers3,
    },
    {
      label: "Assigned Classes",
      value: offering.classes.length,
      helper: "Class groups using this offering",
      icon: School,
    },
    {
      label: "Assigned Teachers",
      value: offering.teachers.length,
      helper: "Active teacher assignments",
      icon: Users,
    },
    {
      label: "Lesson Note Preset",
      value: pretty(offering.lessonNoteTemplateVariant),
      helper: "Used by lesson note workflows",
      icon: BadgeCheck,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black p-6 text-white shadow-2xl shadow-black/40 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => router.push("/admin/subjects")}
              className="mt-1 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {offering.displayName}
                </h1>
                <Badge className={cn(
                  "border px-2 py-0.5 text-[10px]",
                  offering.isActive
                    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/55"
                )}>
                  {offering.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">
                  {offering.code}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs capitalize text-white/65">
                  {pretty(offering.curriculumCode)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs capitalize text-white/65">
                  {pretty(offering.gradeBand)}
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                This is the operational subject identity used for class assignments,
                lesson notes, schemes of learning, exams, timetable slots, and reports.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <BookOpen className="size-3.5" />
                  Family: {offering.subjectFamily}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <Calendar className="size-3.5" />
                  Updated {formatDate(offering.updatedAt)}
                </span>
              </div>
            </div>
          </div>
          <Button
            className="self-start bg-linear-to-r from-amber-300 to-orange-400 text-slate-950 hover:from-amber-200 hover:to-orange-300"
            onClick={() => router.push("/admin/subjects?view=cards")}
          >
            Manage offerings
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="overflow-hidden border-white/10 bg-linear-to-br from-slate-900/80 to-black text-white shadow-xl shadow-black/25">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{stat.label}</p>
                    <p className="truncate text-2xl font-bold capitalize">{stat.value}</p>
                    <p className="truncate text-xs text-white/45">{stat.helper}</p>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-100">
                    <Icon className="size-4" />
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-5 border-white/10 bg-linear-to-br from-slate-900/80 to-black text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers3 className="size-4 text-amber-100" />
              Grade Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {offering.grades.length === 0 ? (
              <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
                No grade coverage is attached to this offering.
              </p>
            ) : (
              offering.grades.map((grade) => (
                <div key={grade.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium">{grade.name}</p>
                    <p className="text-xs text-white/45">{grade.stage || "Stage not set"}</p>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-white/60">
                    {grade.code || "No code"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-7 border-white/10 bg-linear-to-br from-slate-900/80 to-black text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <School className="size-4 text-amber-100" />
              Assigned Class Groups
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {offering.classes.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                This offering has not been assigned to any class group yet.
              </p>
            ) : (
              offering.classes.map((classGroup) => (
                <button
                  key={classGroup.id}
                  onClick={() => router.push(`/admin/classes/${classGroup.id}`)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-amber-300/25 hover:bg-amber-300/5"
                >
                  <div>
                    <p className="text-sm font-medium">{classGroup.fullLabel}</p>
                    <p className="text-xs text-white/45">{classGroup.grade?.name || "No grade"}</p>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-white/60">
                    {classGroup.isActive ? "Active" : "Inactive"}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border-white/10 bg-linear-to-br from-slate-900/80 to-black text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-amber-100" />
            Assigned Teachers
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {offering.teachers.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55 md:col-span-2 xl:col-span-3">
              No teachers are assigned to this exact subject offering yet.
            </p>
          ) : (
            offering.teachers.map((teacher) => (
              <button
                key={teacher.assignmentId}
                onClick={() => teacher.id && router.push(`/admin/teachers/${teacher.id}`)}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-amber-300/25 hover:bg-amber-300/5"
              >
                <Avatar className="size-10 border border-white/15">
                  <AvatarImage src={teacher.photoUrl || ""} alt={teacher.fullName} />
                  <AvatarFallback className="bg-slate-800 text-xs text-white">
                    {initials(teacher.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{teacher.fullName}</p>
                  <p className="truncate text-xs text-white/45">
                    {teacher.classGroupName || teacher.email || "No class context"}
                  </p>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-linear-to-br from-slate-900/80 to-black text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-amber-100" />
            Workflow Context
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-white/40">Stage</p>
            <p className="mt-1 text-sm font-medium capitalize">{pretty(offering.stage)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-white/40">Category</p>
            <p className="mt-1 text-sm font-medium capitalize">{pretty(offering.category)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-white/40">Report Group</p>
            <p className="mt-1 text-sm font-medium capitalize">{offering.reportCardGroup || "Not set"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
