// src/hooks/admin/useClassRoles.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type ClassRoleCategory =
  | "leadership"
  | "academic"
  | "service"
  | "social"
  | "custom";

export type ClassRoleDefinitionDTO = {
  id: string;
  name: string;
  code: string;
  category: ClassRoleCategory;
  description: string | null;
  maxPerClass: number | null;
  isDefault: boolean;
  isActive: boolean;
  order: number;
};

export type StudentRoleAssignmentDTO = {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    photoUrl: string | null;
    admissionNo: string | null;
  };
  role: {
    id: string;
    name: string;
    code: string;
    category: ClassRoleCategory;
    maxPerClass: number | null;
  };
  subject: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  assignedBy: {
    id: string;
    fullName: string;
  } | null;
  assignedAt: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
};

export type GroupedRoleAssignments = {
  leadership: StudentRoleAssignmentDTO[];
  academic: StudentRoleAssignmentDTO[];
  service: StudentRoleAssignmentDTO[];
  social: StudentRoleAssignmentDTO[];
  custom: StudentRoleAssignmentDTO[];
};

export type AssignRoleInput = {
  studentId: string;
  roleDefinitionId: string;
  subjectId?: string;
  startDate?: string;
  endDate?: string | null;
  notes?: string;
};

/**
 * Fetch all class role definitions for the school
 */
export function useClassRoleDefinitions(activeOnly = true) {
  return useQuery<{
    success: boolean;
    data: ClassRoleDefinitionDTO[];
    grouped: Record<ClassRoleCategory, ClassRoleDefinitionDTO[]>;
    total: number;
  }>({
    queryKey: ["class-role-definitions", activeOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeOnly) params.set("active", "1");
      const res = await fetch(`/api/admin/class-roles?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch class role definitions");
      return res.json();
    },
    staleTime: 60_000,
  });
}

/**
 * Create a new custom class role
 */
export function useCreateClassRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      code: string;
      category: ClassRoleCategory;
      description?: string;
      maxPerClass?: number | null;
    }) => {
      const res = await fetch("/api/admin/class-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-role-definitions"] });
    },
  });
}

/**
 * Fetch role assignments for a specific class
 */
export function useClassRoleAssignments(classId: string | undefined) {
  return useQuery<{
    success: boolean;
    data: StudentRoleAssignmentDTO[];
    grouped: GroupedRoleAssignments;
    academicPeriod?: {
      id: string;
      yearLabel: string;
      term: string;
    };
  }>({
    queryKey: ["class-role-assignments", classId],
    queryFn: async () => {
      if (!classId) throw new Error("Class ID is required");
      const res = await fetch(`/api/admin/classes/${classId}/roles`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch class role assignments");
      return res.json();
    },
    enabled: !!classId,
    staleTime: 30_000,
  });
}

/**
 * Assign a role to a student in a class
 */
export function useAssignClassRole(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AssignRoleInput) => {
      const res = await fetch(`/api/admin/classes/${classId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to assign role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-role-assignments", classId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

/**
 * Remove a role assignment
 */
export function useRemoveClassRole(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(
        `/api/admin/classes/${classId}/roles?assignmentId=${assignmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to remove role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-role-assignments", classId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

/**
 * Get role category display info
 */
export function getRoleCategoryInfo(category: ClassRoleCategory) {
  const info: Record<
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
      label: "Social & Welfare",
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
  return info[category] || info.custom;
}
