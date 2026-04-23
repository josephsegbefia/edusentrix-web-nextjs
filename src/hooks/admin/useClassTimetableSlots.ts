/**
 * Hooks for class-group timetable slot CRUD (primary creation path).
 * Uses /api/admin/classes/:classId/timetable/slots.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildTimetableKey,
  type TimetableValidationIssue,
} from "./useTimetablePlanner";

export type ClassTimetableSlotDTO = {
  id: string;
  classGroupId: string;
  gradeId: string;
  subjectId: string;
  /** Empty string when no teacher assigned yet. */
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: string;
  versionId: string;
  academicPeriodId: string;
  createdAt: string;
  updatedAt: string;
};

type ClassSlotsResponse = {
  success: boolean;
  data: ClassTimetableSlotDTO[];
  meta?: { versionId: string | null };
};

type ApiErrorResponse = {
  success?: boolean;
  error?: string;
  issues?: TimetableValidationIssue[];
};

export function buildClassSlotsKey(classId: string, academicPeriodId?: string) {
  return ["class-timetable-slots", classId, academicPeriodId || "none"] as const;
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useClassTimetableSlots(classId: string, academicPeriodId?: string) {
  return useQuery<ClassSlotsResponse>({
    queryKey: buildClassSlotsKey(classId, academicPeriodId),
    queryFn: async () => {
      if (!classId || !academicPeriodId) {
        return { success: true, data: [], meta: { versionId: null } };
      }
      const params = new URLSearchParams({ academicPeriodId });
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/slots?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await readJsonSafe<ApiErrorResponse & ClassSlotsResponse>(res);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch class timetable slots");
      }
      return json as ClassSlotsResponse;
    },
    enabled: Boolean(classId && academicPeriodId),
    staleTime: 30_000,
  });
}

export type CreateClassSlotInput = {
  academicPeriodId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  /** Omit or null when the subject has no teacher assignment yet. */
  teacherId?: string | null;
};

export function useCreateClassSlot(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateClassSlotInput) => {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/slots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json = await readJsonSafe<ApiErrorResponse & { data?: ClassTimetableSlotDTO }>(res);
      if (!res.ok) {
        const error = new Error(json?.error || "Failed to create slot");
        (error as Error & { issues?: TimetableValidationIssue[] }).issues = json?.issues;
        throw error;
      }
      return json;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: buildClassSlotsKey(classId, variables.academicPeriodId),
      });
      queryClient.invalidateQueries({ queryKey: ["timetable-admin"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
    },
  });
}

export type UpdateClassSlotInput = {
  subjectId?: string;
  teacherId?: string | null;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
};

export function useUpdateClassSlot(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slotId,
      payload,
    }: {
      slotId: string;
      payload: UpdateClassSlotInput;
    }) => {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/slots/${encodeURIComponent(slotId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await readJsonSafe<ApiErrorResponse & { data?: ClassTimetableSlotDTO }>(res);
      if (!res.ok) {
        const error = new Error(json?.error || "Failed to update slot");
        (error as Error & { issues?: TimetableValidationIssue[] }).issues = json?.issues;
        throw error;
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-timetable-slots"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-admin"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
    },
  });
}

export function useDeleteClassSlot(classId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slotId: string) => {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/slots/${encodeURIComponent(slotId)}`,
        { method: "DELETE" }
      );
      const json = await readJsonSafe<ApiErrorResponse & { data?: { id: string } }>(res);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete slot");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-timetable-slots"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-admin"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("conflicts"), exact: false });
    },
  });
}
