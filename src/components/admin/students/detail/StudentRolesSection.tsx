// src/components/admin/students/detail/StudentRolesSection.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Crown,
  BookOpen,
  Users,
  Heart,
  Star,
  Loader2,
  AlertCircle,
  ExternalLink,
  Shield,
  Award,
  GraduationCap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type ClassRoleCategory = "leadership" | "academic" | "service" | "social" | "custom";
type SchoolRoleCategory = "prefect" | "council" | "club" | "sports" | "cultural" | "service" | "custom";

type StudentRoleDTO = {
  id: string;
  role: {
    id: string;
    name: string;
    code: string;
    category: ClassRoleCategory;
    description: string | null;
  } | null;
  classGroup: {
    id: string;
    name: string;
    fullLabel: string;
  } | null;
  subject: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  academicPeriod: {
    id: string;
    yearLabel: string;
    term: string;
  } | null;
  isActive: boolean;
  assignedAt: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
};

type SchoolRoleDTO = {
  id: string;
  role: {
    id: string;
    name: string;
    code: string;
    category: SchoolRoleCategory;
    badgeColor: string | null;
  } | null;
  academicPeriod: {
    id: string;
    yearLabel: string;
    term: string;
  } | null;
  isActive: boolean;
  assignedAt: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
};

type StudentRolesSectionProps = {
  studentId: string;
};

const CATEGORY_ICONS: Record<ClassRoleCategory, React.ElementType> = {
  leadership: Crown,
  academic: BookOpen,
  service: Users,
  social: Heart,
  custom: Star,
};

const CATEGORY_INFO: Record<
  ClassRoleCategory,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  leadership: {
    label: "Leadership",
    color: "text-amber-300",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/30",
  },
  academic: {
    label: "Academic",
    color: "text-blue-300",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
  },
  service: {
    label: "Service",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
  },
  social: {
    label: "Social",
    color: "text-purple-300",
    bgColor: "bg-purple-500/20",
    borderColor: "border-purple-500/30",
  },
  custom: {
    label: "Custom",
    color: "text-slate-300",
    bgColor: "bg-slate-500/20",
    borderColor: "border-slate-500/30",
  },
};

const SCHOOL_ROLE_ICONS: Record<SchoolRoleCategory, React.ElementType> = {
  prefect: Crown,
  council: Users,
  club: Award,
  sports: Shield,
  cultural: GraduationCap,
  service: Heart,
  custom: Star,
};

export function StudentRolesSection({ studentId }: StudentRolesSectionProps) {
  const router = useRouter();

  // Fetch class roles
  const { data: classRolesData, isLoading: classRolesLoading, isError: classRolesError } = useQuery<{
    success: boolean;
    data: StudentRoleDTO[];
    currentPeriod?: {
      id: string;
      yearLabel: string;
      term: string;
    };
  }>({
    queryKey: ["student-roles", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${studentId}/roles`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch student roles");
      return res.json();
    },
    enabled: !!studentId,
    staleTime: 30_000,
  });

  // Fetch school-wide roles
  const { data: schoolRolesData, isLoading: schoolRolesLoading, isError: schoolRolesError } = useQuery<{
    success: boolean;
    data: SchoolRoleDTO[];
  }>({
    queryKey: ["student-school-roles", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/students/${studentId}/school-roles`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch school roles");
      return res.json();
    },
    enabled: !!studentId,
    staleTime: 30_000,
  });

  const classRoles = classRolesData?.data || [];
  const schoolRoles = schoolRolesData?.data || [];
  const currentPeriod = classRolesData?.currentPeriod;
  const isLoading = classRolesLoading || schoolRolesLoading;
  const isError = classRolesError || schoolRolesError;
  const hasAnyRoles = classRoles.length > 0 || schoolRoles.length > 0;

  if (isLoading) {
    return (
      <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <Crown className="h-4 w-4 text-amber-400" />
            Class Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <Crown className="h-4 w-4 text-amber-400" />
            Class Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-8 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load roles</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <Crown className="h-4 w-4 text-amber-400" />
            Student Roles
          </CardTitle>
          {currentPeriod && (
            <Badge
              variant="outline"
              className="border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300"
            >
              {currentPeriod.yearLabel} - {currentPeriod.term}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasAnyRoles ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Crown className="h-6 w-6 text-white/30" />
            </div>
            <p className="mt-3 text-sm text-white/50">No roles assigned</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* School-wide roles */}
            {schoolRoles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  School Roles
                </h4>
                <div className="space-y-2">
                  {schoolRoles.map((roleAssignment) => {
                    if (!roleAssignment.role) return null;

                    const RoleIcon = SCHOOL_ROLE_ICONS[roleAssignment.role.category] || Crown;
                    const badgeColor = roleAssignment.role.badgeColor || "#FFD700";

                    return (
                      <div
                        key={roleAssignment.id}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-all hover:bg-white/5"
                        style={{
                          borderColor: `${badgeColor}40`,
                          backgroundColor: `${badgeColor}10`,
                        }}
                      >
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${badgeColor}30` }}
                        >
                          <RoleIcon className="h-4 w-4" style={{ color: badgeColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium" style={{ color: badgeColor }}>
                            {roleAssignment.role.name}
                          </p>
                          <span className="text-xs text-white/50 capitalize">
                            {roleAssignment.role.category}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push("/admin/roles-duties")}
                          className="h-7 w-7 shrink-0 text-white/40 hover:bg-white/10 hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Class roles */}
            {classRoles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                  Class Roles
                </h4>
                <div className="space-y-2">
                  {classRoles.map((roleAssignment) => {
                    if (!roleAssignment.role) return null;

                    const categoryInfo = CATEGORY_INFO[roleAssignment.role.category] || CATEGORY_INFO.custom;
                    const CategoryIcon = CATEGORY_ICONS[roleAssignment.role.category] || Star;

                    return (
                      <div
                        key={roleAssignment.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 transition-all hover:bg-white/5",
                          categoryInfo.borderColor,
                          categoryInfo.bgColor
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg",
                            categoryInfo.bgColor
                          )}
                        >
                          <CategoryIcon className={cn("h-4 w-4", categoryInfo.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium", categoryInfo.color)}>
                            {roleAssignment.role.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {roleAssignment.classGroup && (
                              <span className="text-xs text-white/50">
                                {roleAssignment.classGroup.fullLabel}
                              </span>
                            )}
                            {roleAssignment.subject && (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-white/20 bg-white/5"
                              >
                                {roleAssignment.subject.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {roleAssignment.classGroup && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              router.push(`/admin/classes/${roleAssignment.classGroup!.id}?tab=roles`)
                            }
                            className="h-7 w-7 shrink-0 text-white/40 hover:bg-white/10 hover:text-white"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
