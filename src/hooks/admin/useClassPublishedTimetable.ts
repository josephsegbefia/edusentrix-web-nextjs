/**
 * Published class-group timetable (read) + bulk delete for the class on that version.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildTimetableKey } from "./useTimetablePlanner";
import { buildClassSlotsKey } from "./useClassTimetableSlots";

export type PublishedClassSlotDTO = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string;
  teacherName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
};

export type ClassPublishedTimetableMeta = {
  hasPublishedVersion: boolean;
  versionId: string | null;
  publishedAt: string | null;
  slotCount: number;
  workingDays: number[];
  timeAxis: {
    startHour: number;
    endHour: number;
    hours: number[];
  };
  hourLabels?: string[];
  canManage: boolean;
};

type PublishedResponse = {
  success: boolean;
  data: PublishedClassSlotDTO[];
  meta: ClassPublishedTimetableMeta;
};

function buildKey(classId: string, academicPeriodId?: string) {
  return ["class-published-timetable", classId, academicPeriodId || "none"] as const;
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useClassPublishedTimetable(classId: string, academicPeriodId?: string) {
  return useQuery<PublishedResponse>({
    queryKey: buildKey(classId, academicPeriodId),
    queryFn: async () => {
      if (!classId || !academicPeriodId) {
        return {
          success: true,
          data: [],
          meta: {
            hasPublishedVersion: false,
            versionId: null,
            publishedAt: null,
            slotCount: 0,
            workingDays: [1, 2, 3, 4, 5],
            timeAxis: {
              startHour: 6,
              endHour: 20,
              hours: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
            },
            canManage: false,
          },
        };
      }
      const params = new URLSearchParams({ academicPeriodId });
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/published?${params}`,
        { cache: "no-store" }
      );
      const json = await readJson<PublishedResponse & { error?: string }>(res);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load published timetable");
      }
      return json as PublishedResponse;
    },
    enabled: Boolean(classId && academicPeriodId),
    staleTime: 30_000,
  });
}

export function useDeleteClassPublishedTimetable(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (academicPeriodId: string) => {
      const params = new URLSearchParams({ academicPeriodId });
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/published?${params}`,
        { method: "DELETE" }
      );
      const json = await readJson<{ success?: boolean; error?: string }>(res);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to remove published class timetable");
      }
      return json;
    },
    onSuccess: (_, academicPeriodId) => {
      queryClient.invalidateQueries({ queryKey: buildKey(classId, academicPeriodId) });
      queryClient.invalidateQueries({ queryKey: ["class-timetable-slots"] });
      queryClient.invalidateQueries({ queryKey: buildClassSlotsKey(classId, academicPeriodId) });
      queryClient.invalidateQueries({ queryKey: ["timetable-admin"] });
      queryClient.invalidateQueries({ queryKey: buildTimetableKey("conflicts"), exact: false });
    },
  });
}
