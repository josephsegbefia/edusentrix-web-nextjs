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
  subjectOfferingId?: string | null;
  /** Empty string when no teacher assigned yet. */
  teacherId: string;
  roomId?: string | null;
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
  code?: string;
  error?: string;
  issues?: TimetableValidationIssue[];
  conflict?: TimetableWriteConflict;
  conflicts?: TimetableWriteConflict[];
};

export type TimetableWriteConflictSlotSummary = {
  slotId: string | null;
  classGroupId: string;
  className: string;
  gradeId: string;
  gradeName: string;
  subjectId: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
  roomId: string | null;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
};

export type TimetableWriteConflict = {
  code: "TEACHER_OVERLAP" | "CLASS_OVERLAP" | "ROOM_OVERLAP";
  severity: "error";
  message: string;
  attemptedSlot: TimetableWriteConflictSlotSummary;
  conflictingSlots: TimetableWriteConflictSlotSummary[];
  suggestions: string[];
};

export type TimetableWriteConflictError = Error & {
  issues?: TimetableValidationIssue[];
  conflict?: TimetableWriteConflict;
  conflicts?: TimetableWriteConflict[];
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
  subjectOfferingId?: string | null;
  subjectId: string;
  /** Required so teacher conflicts can be checked before saving. */
  teacherId: string;
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
        const error = new Error(json?.error || "Failed to create slot") as TimetableWriteConflictError;
        error.issues = json?.issues;
        error.conflict = json?.conflict;
        error.conflicts = json?.conflicts;
        throw error;
      }
      return json;
    },
    onSuccess: (json, variables) => {
      queryClient.invalidateQueries({
        queryKey: buildClassSlotsKey(classId, variables.academicPeriodId),
      });
      queryClient.invalidateQueries({ queryKey: ["timetable-admin"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
      if (json?.data?.versionId) {
        queryClient.invalidateQueries({
          queryKey: buildTimetableKey("conflicts", json.data.versionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("conflicts"), exact: false });
    },
  });
}

export type UpdateClassSlotInput = {
  subjectOfferingId?: string | null;
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
        const error = new Error(json?.error || "Failed to update slot") as TimetableWriteConflictError;
        error.issues = json?.issues;
        error.conflict = json?.conflict;
        error.conflicts = json?.conflicts;
        throw error;
      }
      return json;
    },
    onSuccess: (json) => {
      if (json?.data?.academicPeriodId) {
        queryClient.invalidateQueries({
          queryKey: buildClassSlotsKey(classId, json.data.academicPeriodId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["class-timetable-slots"] });
      }
      queryClient.invalidateQueries({ queryKey: ["timetable-admin"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
      if (json?.data?.versionId) {
        queryClient.invalidateQueries({
          queryKey: buildTimetableKey("conflicts", json.data.versionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("conflicts"), exact: false });
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
      const json = await readJsonSafe<
        ApiErrorResponse & {
          data?: {
            id: string;
            academicPeriodId?: string;
            versionId?: string;
            teacherId?: string;
            subjectId?: string;
          };
        }
      >(res);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete slot");
      }
      return json;
    },
    onSuccess: (json) => {
      const deletedId = json?.data?.id;
      const academicPeriodId = json?.data?.academicPeriodId;
      if (deletedId && academicPeriodId) {
        queryClient.setQueryData<ClassSlotsResponse>(
          buildClassSlotsKey(classId, academicPeriodId),
          (old) =>
            old
              ? {
                  ...old,
                  data: old.data.filter((slot) => slot.id !== deletedId),
                }
              : old
        );
        queryClient.invalidateQueries({
          queryKey: buildClassSlotsKey(classId, academicPeriodId),
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["class-timetable-slots"] });
      }
      queryClient.invalidateQueries({ queryKey: ["timetable-admin"] });
      queryClient.invalidateQueries({ queryKey: ["class-subject-teachers"] });
      if (json?.data?.versionId) {
        queryClient.invalidateQueries({
          queryKey: buildTimetableKey("conflicts", json.data.versionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("conflicts"), exact: false });
    },
  });
}
