// src/components/admin/classes/detail/ClassSubjectsTeachersTab.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  UserPlus,
  UserCheck,
  Users,
  ExternalLink,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  BookPlus,
  ArrowRight,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type ClassSubjectsTeachersTabProps = {
  classId: string;
  className: string;
  subjects: Array<{ id: string; name: string; code: string | null }>;
  onManageSubjects?: () => void;
  onOpenAssignmentWizard?: () => void;
};

type SubjectTeacherAssignment = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teachers: Array<{
    id: string;
    assignmentId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
  }>;
};

export function ClassSubjectsTeachersTab({
  classId,
  className,
  subjects,
  onManageSubjects,
  onOpenAssignmentWizard,
}: ClassSubjectsTeachersTabProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch subject-teacher assignments for this class
  const { data, isLoading, isError } = useQuery<{
    success: boolean;
    data: SubjectTeacherAssignment[];
  }>({
    queryKey: ["class-subject-teachers", classId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/classes/${classId}/subject-teachers`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch subject teachers");
      return res.json();
    },
    staleTime: 30_000,
  });

  const assignments = data?.data || [];

  // Create a map of subject assignments
  const assignmentMap = React.useMemo(() => {
    const map = new Map<string, SubjectTeacherAssignment>();
    assignments.forEach((a) => map.set(a.subjectId, a));
    return map;
  }, [assignments]);

  // Combine subjects with their assignments
  const subjectAssignments = React.useMemo(() => {
    return subjects.map((subject) => {
      const assignment = assignmentMap.get(subject.id);
      return {
        ...subject,
        teachers: assignment?.teachers || [],
      };
    });
  }, [subjects, assignmentMap]);

  // Count stats
  const assignedSubjectsCount = subjectAssignments.filter(
    (s) => s.teachers.length > 0
  ).length;
  const unassignedSubjectsCount = subjectAssignments.filter(
    (s) => s.teachers.length === 0
  ).length;
  const totalTeachersCount = new Set(
    subjectAssignments.flatMap((s) => s.teachers.map((t) => t.id))
  ).size;

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  const handleViewTeacher = (teacherId: string) => {
    router.push(`/admin/teachers/${teacherId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Subjects & Teachers
          </h2>
          <p className="text-sm text-white/50">
            Manage subject assignments and teaching staff for {className}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onManageSubjects}
            className="gap-2 border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            <BookPlus className="h-4 w-4" />
            Manage Subjects
          </Button>
          <Button
            onClick={onOpenAssignmentWizard}
            className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-indigo-700"
          >
            <UserPlus className="h-4 w-4" />
            Assign Teachers
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{subjects.length}</p>
              <p className="text-xs text-white/50">Total Subjects</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{assignedSubjectsCount}</p>
              <p className="text-xs text-white/50">Assigned</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalTeachersCount}</p>
              <p className="text-xs text-white/50">Teachers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unassigned Warning */}
      {unassignedSubjectsCount > 0 && (
        <Card className="border border-amber-500/30 bg-amber-500/10 backdrop-blur">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-200">
                {unassignedSubjectsCount} subject{unassignedSubjectsCount !== 1 ? "s" : ""} without a teacher
              </p>
              <p className="text-xs text-amber-200/70">
                Assign teachers to ensure all subjects are covered
              </p>
            </div>
            <Button
              onClick={onOpenAssignmentWizard}
              size="sm"
              className="gap-2 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
            >
              Assign Now
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Subject-Teacher List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="mt-3 text-sm text-white/50">Loading assignments...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          <p className="mt-3 text-sm font-medium text-white/70">
            Failed to load assignments
          </p>
        </div>
      ) : subjects.length === 0 ? (
        <Card className="border border-white/10 bg-slate-950/60 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <BookOpen className="h-8 w-8 text-white/30" />
            </div>
            <p className="mt-4 text-sm font-medium text-white/70">
              No subjects assigned to this class
            </p>
            <p className="mt-1 text-xs text-white/50">
              Add subjects first to assign teachers
            </p>
            <Button
              onClick={onManageSubjects}
              className="mt-4 gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
            >
              <BookPlus className="h-4 w-4" />
              Add Subjects
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjectAssignments.map((subject) => (
            <Card
              key={subject.id}
              className={cn(
                "border bg-gradient-to-br backdrop-blur transition-all",
                subject.teachers.length > 0
                  ? "border-white/10 from-slate-900/80 to-slate-950/90"
                  : "border-dashed border-white/10 from-slate-950/50 to-black/50"
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Subject Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        subject.teachers.length > 0
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-white/5 text-white/30"
                      )}
                    >
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{subject.name}</p>
                      {subject.code && (
                        <p className="text-xs text-white/50">{subject.code}</p>
                      )}
                    </div>
                  </div>

                  {/* Teachers */}
                  <div className="flex items-center gap-2">
                    {subject.teachers.length > 0 ? (
                      <div className="flex items-center gap-2">
                        {/* Stacked avatars for multiple teachers */}
                        <div className="flex -space-x-2">
                          {subject.teachers.slice(0, 3).map((teacher, idx) => (
                            <Avatar
                              key={teacher.id}
                              className="h-8 w-8 border-2 border-slate-900 ring-0"
                              style={{ zIndex: 10 - idx }}
                            >
                              <AvatarImage
                                src={teacher.photoUrl || ""}
                                alt={teacher.fullName}
                              />
                              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-700 text-[10px] font-semibold text-white">
                                {getInitials(teacher.firstName, teacher.lastName)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {subject.teachers.length > 3 && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-white/10 text-[10px] font-medium text-white">
                              +{subject.teachers.length - 3}
                            </div>
                          )}
                        </div>

                        {/* Teacher names */}
                        <div className="hidden sm:block">
                          <p className="text-sm text-white">
                            {subject.teachers
                              .slice(0, 2)
                              .map((t) => t.fullName)
                              .join(", ")}
                            {subject.teachers.length > 2 &&
                              ` +${subject.teachers.length - 2}`}
                          </p>
                          {subject.teachers.length > 1 && (
                            <Badge
                              variant="outline"
                              className="mt-1 rounded-full border-purple-500/30 bg-purple-500/10 text-[10px] text-purple-300"
                            >
                              Co-teaching
                            </Badge>
                          )}
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2 h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border border-white/10 bg-slate-900/95 text-xs text-slate-50 backdrop-blur-xl"
                          >
                            {subject.teachers.map((teacher) => (
                              <DropdownMenuItem
                                key={teacher.id}
                                onClick={() => handleViewTeacher(teacher.id)}
                                className="cursor-pointer gap-2"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                View {teacher.fullName}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                              onClick={onOpenAssignmentWizard}
                              className="cursor-pointer gap-2"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Change Teacher
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenAssignmentWizard}
                        className="gap-2 border-dashed border-white/20 bg-transparent text-xs text-white/50 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Assign Teacher
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
