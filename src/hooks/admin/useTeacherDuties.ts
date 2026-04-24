// src/hooks/admin/useTeacherDuties.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface DutyDefinitionDTO {
  id: string;
  name: string;
  code: string;
  category: "supervision" | "assembly" | "break" | "gate" | "dining" | "sports" | "exam" | "event" | "custom";
  description: string | null;
  frequency: "daily" | "weekly" | "rotational" | "one_time";
  defaultDays: number[];
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  location: string | null;
  minTeachersRequired: number;
  maxTeachersAllowed: number | null;
  color: string | null;
  order: number;
  isActive: boolean;
}

export interface DutyAssignmentDTO {
  id: string;
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    photoUrl: string | null;
  } | null;
  duty: {
    id: string;
    name: string;
    code: string;
    category: string;
    color: string | null;
    location: string | null;
  } | null;
  days: number[];
  startTime: string;
  endTime: string;
  specificDate: string | null;
  weekNumber: number | null;
  assignedAt: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
}

interface TeacherDutiesResponse {
  success: boolean;
  data: DutyDefinitionDTO[];
  grouped: {
    supervision: DutyDefinitionDTO[];
    assembly: DutyDefinitionDTO[];
    break: DutyDefinitionDTO[];
    gate: DutyDefinitionDTO[];
    dining: DutyDefinitionDTO[];
    sports: DutyDefinitionDTO[];
    exam: DutyDefinitionDTO[];
    event: DutyDefinitionDTO[];
    custom: DutyDefinitionDTO[];
  };
  assignments?: DutyAssignmentDTO[];
  currentPeriod: {
    id: string;
    yearLabel: string;
    term: string;
  } | null;
}

export function useTeacherDuties(includeAssignments = true, teacherId?: string) {
  return useQuery<TeacherDutiesResponse>({
    queryKey: ["teacher-duties", includeAssignments, teacherId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeAssignments) params.set("assignments", "1");
      if (teacherId) params.set("teacherId", teacherId);
      const res = await fetch(`/api/admin/teacher-duties?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch teacher duties");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useAssignTeacherDuty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      teacherId: string;
      dutyDefinitionId: string;
      days: number[];
      startTime: string;
      endTime: string;
      specificDate?: string;
      weekNumber?: number;
      startDate?: string;
      endDate?: string;
      notes?: string;
    }) => {
      const res = await fetch("/api/admin/teacher-duties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to assign duty");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-duties"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-week-agenda"] });
    },
  });
}

export function useRemoveTeacherDuty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await fetch(`/api/admin/teacher-duties?assignmentId=${assignmentId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove duty");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-duties"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-week-agenda"] });
    },
  });
}

export function useCreateDutyDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      code: string;
      category: string;
      description?: string;
      frequency: string;
      defaultDays?: number[];
      defaultStartTime?: string;
      defaultEndTime?: string;
      location?: string;
      minTeachersRequired?: number;
      maxTeachersAllowed?: number;
      color?: string;
    }) => {
      const res = await fetch("/api/admin/teacher-duties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create duty definition");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-duties"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-week-agenda"] });
    },
  });
}

export function useUpdateDutyDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      definitionId,
      data,
    }: {
      definitionId: string;
      data: {
        name?: string;
        description?: string | null;
        frequency?: "daily" | "weekly" | "rotational" | "one_time";
        defaultDays?: number[];
        defaultStartTime?: string | null;
        defaultEndTime?: string | null;
        location?: string | null;
        minTeachersRequired?: number;
        maxTeachersAllowed?: number | null;
        color?: string;
        isActive?: boolean;
      };
    }) => {
      const res = await fetch(`/api/admin/teacher-duties?definitionId=${definitionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update duty definition");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-duties"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-week-agenda"] });
    },
  });
}

export function useDeleteDutyDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (definitionId: string) => {
      const res = await fetch(`/api/admin/teacher-duties?definitionId=${definitionId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete duty definition");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-duties"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-week-agenda"] });
    },
  });
}

// Helper to format days
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDays(days: number[]): string {
  if (days.length === 5 && days.every((d, i) => d === i + 1)) {
    return "Weekdays";
  }
  if (days.length === 7) {
    return "Every day";
  }
  return days.map((d) => DAY_NAMES[d]).join(", ");
}
