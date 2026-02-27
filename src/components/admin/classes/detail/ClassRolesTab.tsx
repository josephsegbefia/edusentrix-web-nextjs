// src/components/admin/classes/detail/ClassRolesTab.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Crown,
  BookOpen,
  Heart,
  Sparkles,
  UserPlus,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Users,
  Award,
  Star,
} from "lucide-react";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
} from "@/components/ui/premium-dropdown-menu";
import {
  useClassRoleAssignments,
  useRemoveClassRole,
  getRoleCategoryInfo,
  type ClassRoleCategory,
  type StudentRoleAssignmentDTO,
} from "@/hooks/admin/useClassRoles";
import { useBusyToast } from "@/hooks/useBusyToast";

type ClassRolesTabProps = {
  classId: string;
  className: string;
  onAssignRole?: () => void;
};

const CATEGORY_ICONS: Record<ClassRoleCategory, React.ElementType> = {
  leadership: Crown,
  academic: BookOpen,
  service: Users,
  social: Heart,
  custom: Star,
};

function RoleCard({
  assignment,
  classId,
  onViewStudent,
}: {
  assignment: StudentRoleAssignmentDTO;
  classId: string;
  onViewStudent: (id: string) => void;
}) {
  const removeRole = useRemoveClassRole(classId);
  const busy = useBusyToast();
  const categoryInfo = getRoleCategoryInfo(assignment.role.category);
  const CategoryIcon = CATEGORY_ICONS[assignment.role.category] || Star;

  const handleRemove = async () => {
    try {
      await busy.promise(removeRole.mutateAsync(assignment.id), {
        loading: "Removing role...",
        success: "Role removed successfully",
        error: (e: Error) => e.message || "Failed to remove role",
      });
    } catch {
      // Error handled by toast
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4 transition-all hover:shadow-lg",
        categoryInfo.borderColor,
        categoryInfo.bgColor
      )}
    >
      <div className="flex items-start gap-3">
        {/* Student Avatar */}
        <Avatar className="h-12 w-12 border-2 border-white/20 shadow-md">
          <AvatarImage
            src={assignment.student.photoUrl || ""}
            alt={assignment.student.fullName}
          />
          <AvatarFallback
            className={cn("text-sm font-semibold text-white", categoryInfo.bgColor)}
          >
            {getInitials(assignment.student.firstName, assignment.student.lastName)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white truncate">
              {assignment.student.fullName}
            </p>
            {assignment.student.admissionNo && (
              <Badge
                variant="outline"
                className="shrink-0 border-white/20 bg-white/5 text-[10px] text-white/60"
              >
                {assignment.student.admissionNo}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <CategoryIcon className={cn("h-3.5 w-3.5", categoryInfo.color)} />
            <span className={cn("text-sm font-medium", categoryInfo.color)}>
              {assignment.role.name}
            </span>
          </div>
          {assignment.subject && (
            <p className="mt-1 text-xs text-white/50">
              Subject: {assignment.subject.name}
            </p>
          )}
        </div>

        {/* Actions */}
        <PremiumDropdownMenu>
          <PremiumDropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-white/60 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-white transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PremiumDropdownMenuTrigger>
          <PremiumDropdownMenuContent
            align="end"
            className="border border-white/10 bg-slate-900/95 text-xs text-slate-50 backdrop-blur-xl"
          >
            <PremiumDropdownMenuItem
              onClick={() => onViewStudent(assignment.student.id)}
              className="cursor-pointer gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Student
            </PremiumDropdownMenuItem>
            <PremiumDropdownMenuSeparator className="bg-white/10" />
            <PremiumDropdownMenuItem
              onClick={handleRemove}
              className="cursor-pointer gap-2 text-red-400 focus:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Role
            </PremiumDropdownMenuItem>
          </PremiumDropdownMenuContent>
        </PremiumDropdownMenu>
      </div>

      {/* Assigned date */}
      <p className="mt-3 text-[10px] text-white/40">
        Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
        {assignment.assignedBy && ` by ${assignment.assignedBy.fullName}`}
      </p>
    </div>
  );
}

function CategorySection({
  category,
  assignments,
  classId,
  onViewStudent,
}: {
  category: ClassRoleCategory;
  assignments: StudentRoleAssignmentDTO[];
  classId: string;
  onViewStudent: (id: string) => void;
}) {
  const categoryInfo = getRoleCategoryInfo(category);
  const CategoryIcon = CATEGORY_ICONS[category] || Star;

  if (assignments.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CategoryIcon className={cn("h-4 w-4", categoryInfo.color)} />
        <h3 className={cn("text-sm font-semibold", categoryInfo.color)}>
          {categoryInfo.label}
        </h3>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            categoryInfo.borderColor,
            categoryInfo.bgColor,
            categoryInfo.color
          )}
        >
          {assignments.length}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assignments.map((assignment) => (
          <RoleCard
            key={assignment.id}
            assignment={assignment}
            classId={classId}
            onViewStudent={onViewStudent}
          />
        ))}
      </div>
    </div>
  );
}

export function ClassRolesTab({
  classId,
  className,
  onAssignRole,
}: ClassRolesTabProps) {
  const router = useRouter();
  const { data, isLoading, isError } = useClassRoleAssignments(classId);

  const assignments = data?.data || [];
  const grouped = data?.grouped;
  const academicPeriod = data?.academicPeriod;

  const handleViewStudent = (studentId: string) => {
    router.push(`/admin/students/${studentId}`);
  };

  // Count stats
  const totalAssignments = assignments.length;
  const uniqueStudents = new Set(assignments.map((a) => a.student.id)).size;
  const leadershipCount = grouped?.leadership.length || 0;

  return (
    <div className="space-y-6">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Student Roles</h2>
          <p className="text-sm text-white/50">
            Manage student leadership and service roles for {className}
          </p>
          {academicPeriod && (
            <Badge
              variant="outline"
              className="mt-2 border-violet-500/30 bg-violet-500/10 text-violet-300"
            >
              {academicPeriod.yearLabel} - {academicPeriod.term}
            </Badge>
          )}
        </div>
        <Button
          onClick={onAssignRole}
          className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700"
        >
          <UserPlus className="h-4 w-4" />
          Assign Role
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalAssignments}</p>
              <p className="text-xs text-white/50">Total Roles Assigned</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{uniqueStudents}</p>
              <p className="text-xs text-white/50">Students with Roles</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{leadershipCount}</p>
              <p className="text-xs text-white/50">Leadership Positions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Assignments by Category */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="mt-3 text-sm text-white/50">Loading role assignments...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          <p className="mt-3 text-sm font-medium text-white/70">
            Failed to load role assignments
          </p>
        </div>
      ) : assignments.length === 0 ? (
        <Card className="border border-white/10 bg-slate-950/60 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Crown className="h-8 w-8 text-white/30" />
            </div>
            <p className="mt-4 text-sm font-medium text-white/70">
              No roles assigned yet
            </p>
            <p className="mt-1 text-xs text-white/50">
              Assign leadership and service roles to students
            </p>
            <Button
              onClick={onAssignRole}
              className="mt-4 gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
            >
              <UserPlus className="h-4 w-4" />
              Assign First Role
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped && (
            <>
              <CategorySection
                category="leadership"
                assignments={grouped.leadership}
                classId={classId}
                onViewStudent={handleViewStudent}
              />
              <CategorySection
                category="academic"
                assignments={grouped.academic}
                classId={classId}
                onViewStudent={handleViewStudent}
              />
              <CategorySection
                category="service"
                assignments={grouped.service}
                classId={classId}
                onViewStudent={handleViewStudent}
              />
              <CategorySection
                category="social"
                assignments={grouped.social}
                classId={classId}
                onViewStudent={handleViewStudent}
              />
              <CategorySection
                category="custom"
                assignments={grouped.custom}
                classId={classId}
                onViewStudent={handleViewStudent}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
