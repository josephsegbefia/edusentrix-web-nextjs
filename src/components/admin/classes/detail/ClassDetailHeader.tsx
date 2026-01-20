// src/components/admin/classes/detail/ClassDetailHeader.tsx
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  School,
  Users,
  BookOpen,
  UserCheck,
  GraduationCap,
  Calendar,
  Home,
} from "lucide-react";

export type ClassDetailData = {
  id: string;
  name: string;
  fullLabel: string;
  grade: {
    id: string;
    name: string;
    code: string | null;
    stage: string;
    order: number;
  };
  homeroomTeacher: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
  } | null;
  studentCount: number;
  teacherCount: number;
  subjectCount: number;
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
};

type ClassDetailHeaderProps = {
  classData: ClassDetailData;
};

export function ClassDetailHeader({ classData }: ClassDetailHeaderProps) {
  const {
    fullLabel,
    grade,
    homeroomTeacher,
    studentCount,
    teacherCount,
    subjectCount,
    capacity,
    isActive,
    createdAt,
  } = classData;

  const createdLabel = React.useMemo(() => {
    const d = new Date(createdAt);
    return d.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [createdAt]);

  const homeroomInitials = homeroomTeacher
    ? `${homeroomTeacher.firstName?.charAt(0) || ""}${homeroomTeacher.lastName?.charAt(0) || ""}`.toUpperCase() ||
      "HT"
    : null;

  const capacityPercent = capacity && capacity > 0 ? Math.round((studentCount / capacity) * 100) : null;

  return (
    <Card className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
      {/* Background decorations */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-transparent blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-70"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-teal-500/10 via-lime-500/5 to-transparent blur-3xl"
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
            {/* Icon */}
            <div className="relative shrink-0">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-white/20 bg-gradient-to-br from-emerald-500/30 to-green-600/30 shadow-2xl shadow-black/50 ring-4 ring-emerald-500/20">
                  <School className="h-10 w-10 text-emerald-200" />
                </div>
                {/* Status indicator */}
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 h-6 w-6 rounded-lg border-2 border-slate-900 flex items-center justify-center",
                    isActive ? "bg-emerald-500" : "bg-slate-500"
                  )}
                >
                  <GraduationCap className="h-3 w-3 text-white" />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Name and Status */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    {fullLabel}
                  </h1>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-semibold",
                      isActive
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border-slate-500/40 bg-slate-500/15 text-slate-300"
                    )}
                  >
                    {isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Grade Info */}
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <GraduationCap className="h-4 w-4" />
                  <span>{grade.name}</span>
                  {grade.stage && (
                    <>
                      <span className="text-white/30">•</span>
                      <span>{grade.stage}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {homeroomTeacher && (
                  <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/15 px-3 py-1.5">
                    <Avatar className="h-6 w-6 border border-white/20">
                      <AvatarImage
                        src={homeroomTeacher.photoUrl || ""}
                        alt={homeroomTeacher.fullName}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-violet-700 text-[10px] font-semibold text-white">
                        {homeroomInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5 text-purple-300" />
                      <span className="text-xs font-medium text-purple-200">
                        {homeroomTeacher.fullName}
                      </span>
                    </div>
                  </div>
                )}

                {/* Capacity indicator */}
                {capacity && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium",
                      capacityPercent && capacityPercent >= 90
                        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                        : "border-white/10 bg-white/5 text-white/60"
                    )}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {studentCount} / {capacity}
                    {capacityPercent !== null && (
                      <span className="text-white/40">({capacityPercent}%)</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Users className="h-5 w-5 text-emerald-400" />
              <div className="text-right">
                <p className="text-2xl font-bold text-white tabular-nums">{studentCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/40">Students</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <BookOpen className="h-5 w-5 text-blue-400" />
              <div className="text-right">
                <p className="text-2xl font-bold text-white tabular-nums">{subjectCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/40">Subjects</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <UserCheck className="h-5 w-5 text-purple-400" />
              <div className="text-right">
                <p className="text-2xl font-bold text-white tabular-nums">{teacherCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/40">Teachers</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Calendar className="h-5 w-5 text-teal-400" />
              <div className="text-right">
                <p className="text-xs font-medium text-white/80">{createdLabel}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/40">Created</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
