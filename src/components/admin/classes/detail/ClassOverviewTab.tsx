// src/components/admin/classes/detail/ClassOverviewTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Users,
  BookOpen,
  UserCheck,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Percent,
  Home,
  ArrowRight,
  UserPlus,
  BookPlus,
} from "lucide-react";
import type { ClassDetailData } from "./ClassDetailHeader";

type ClassOverviewTabProps = {
  classData: ClassDetailData;
  onAddStudent?: () => void;
  onManageSubjects?: () => void;
  onAssignHomeroom?: () => void;
};

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  trend?: { value: number; label: string };
  className?: string;
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl transition-all hover:border-white/20",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">
              {title}
            </p>
            <p className="text-3xl font-bold tabular-nums text-white">{value}</p>
            {subtitle && (
              <p className="text-xs text-white/40">{subtitle}</p>
            )}
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  trend.value >= 0 ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {trend.value >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>
                  {trend.value >= 0 ? "+" : ""}
                  {trend.value}% {trend.label}
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border border-white/10",
              iconColor
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClassOverviewTab({
  classData,
  onAddStudent,
  onManageSubjects,
  onAssignHomeroom,
}: ClassOverviewTabProps) {
  const {
    homeroomTeacher,
    studentCount,
    teacherCount,
    subjectCount,
    capacity,
    grade,
  } = classData;

  const capacityPercent =
    capacity && capacity > 0 ? Math.round((studentCount / capacity) * 100) : null;

  const homeroomInitials = homeroomTeacher
    ? `${homeroomTeacher.firstName?.charAt(0) || ""}${homeroomTeacher.lastName?.charAt(0) || ""}`.toUpperCase() ||
      "HT"
    : null;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Enrolled Students"
          value={studentCount}
          subtitle={capacity ? `Capacity: ${capacity}` : undefined}
          icon={Users}
          iconColor="bg-emerald-500/20 text-emerald-300"
        />
        <StatCard
          title="Subjects"
          value={subjectCount}
          icon={BookOpen}
          iconColor="bg-blue-500/20 text-blue-300"
        />
        <StatCard
          title="Teachers"
          value={teacherCount}
          subtitle="Subject teachers"
          icon={UserCheck}
          iconColor="bg-purple-500/20 text-purple-300"
        />
        <StatCard
          title="Capacity"
          value={capacityPercent !== null ? `${capacityPercent}%` : "—"}
          subtitle={capacity ? `${studentCount} of ${capacity} students` : "No limit set"}
          icon={Percent}
          iconColor={
            capacityPercent && capacityPercent >= 90
              ? "bg-amber-500/20 text-amber-300"
              : "bg-teal-500/20 text-teal-300"
          }
        />
      </div>

      {/* Quick Actions & Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Homeroom Teacher Card */}
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <Home className="h-4 w-4 text-purple-400" />
              Homeroom Teacher
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {homeroomTeacher ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-white/20">
                    <AvatarImage
                      src={homeroomTeacher.photoUrl || ""}
                      alt={homeroomTeacher.fullName}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-violet-700 text-sm font-semibold text-white">
                      {homeroomInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-white">
                      {homeroomTeacher.fullName}
                    </p>
                    <p className="text-xs text-white/50">
                      {homeroomTeacher.email || "No email"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAssignHomeroom}
                  className="gap-2 border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Change
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/5">
                    <AlertCircle className="h-5 w-5 text-white/30" />
                  </div>
                  <div>
                    <p className="font-medium text-white/60">Not Assigned</p>
                    <p className="text-xs text-white/40">
                      No homeroom teacher assigned yet
                    </p>
                  </div>
                </div>
                <Button
                  onClick={onAssignHomeroom}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/20 hover:from-purple-600 hover:to-violet-700"
                >
                  Assign
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="text-sm font-semibold text-white">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={onAddStudent}
                className="h-auto flex-col gap-2 border-white/10 bg-white/5 py-4 text-white/70 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300"
              >
                <UserPlus className="h-5 w-5" />
                <span className="text-xs">Add Student</span>
              </Button>
              <Button
                variant="outline"
                onClick={onManageSubjects}
                className="h-auto flex-col gap-2 border-white/10 bg-white/5 py-4 text-white/70 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-300"
              >
                <BookPlus className="h-5 w-5" />
                <span className="text-xs">Manage Subjects</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Class Info Summary */}
      <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardHeader className="border-b border-white/10 pb-4">
          <CardTitle className="text-sm font-semibold text-white">
            Class Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/40">Grade</p>
              <p className="font-medium text-white">{grade.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/40">Stage</p>
              <p className="font-medium text-white">{grade.stage || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/40">Capacity</p>
              <p className="font-medium text-white">{capacity || "Unlimited"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/40">Status</p>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full text-[10px]",
                  classData.isActive
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-500/30 bg-slate-500/10 text-slate-300"
                )}
              >
                {classData.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
