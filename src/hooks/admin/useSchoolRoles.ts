// src/hooks/admin/useSchoolRoles.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SchoolRoleDefinitionDTO {
  id: string;
  name: string;
  code: string;
  category: "prefect" | "council" | "club" | "sports" | "cultural" | "service" | "custom";
  description: string | null;
  maxPerSchool: number | null;
  eligibleGrades: string[];
  badgeColor: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
}

export interface SchoolRoleAssignmentDTO {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    photoUrl: string | null;
    admissionNo: string | null;
    className: string | null;
  } | null;
  role: {
    id: string;
    name: string;
    code: string;
    category: string;
    badgeColor: string | null;
  } | null;
  house: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  assignedAt: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
}

interface SchoolRolesResponse {
  success: boolean;
  data: SchoolRoleDefinitionDTO[];
  grouped: {
    prefect: SchoolRoleDefinitionDTO[];
    council: SchoolRoleDefinitionDTO[];
    club: SchoolRoleDefinitionDTO[];
    sports: SchoolRoleDefinitionDTO[];
    cultural: SchoolRoleDefinitionDTO[];
    service: SchoolRoleDefinitionDTO[];
    custom: SchoolRoleDefinitionDTO[];
  };
  assignments?: SchoolRoleAssignmentDTO[];
  currentPeriod: {
    id: string;
    yearLabel: string;
    term: string;
  } | null;
}

export function useSchoolRoles(includeAssignments = true) {
  return useQuery<SchoolRolesResponse>({
    queryKey: ["school-roles", includeAssignments],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeAssignments) params.set("assignments", "1");
      const res = await fetch(`/api/admin/school-roles?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch school roles");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useAssignSchoolRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      studentId: string;
      roleDefinitionId: string;
      houseId?: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
    }) => {
      const res = await fetch("/api/admin/school-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to assign role");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-roles"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useRemoveSchoolRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(`/api/admin/school-roles?assignmentId=${assignmentId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove role");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-roles"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useCreateSchoolRoleDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      code: string;
      category: string;
      description?: string;
      maxPerSchool?: number;
      eligibleGrades?: string[];
      badgeColor?: string;
      icon?: string;
    }) => {
      const res = await fetch("/api/admin/school-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create role definition");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-roles"] });
    },
  });
}
