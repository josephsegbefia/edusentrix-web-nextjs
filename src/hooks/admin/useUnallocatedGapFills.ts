import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export type UnallocatedGapFillRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  presetCode: string;
  updatedAt: string | null;
};

const key = (classId: string) => ["unallocated-gap-fills", classId] as const;

export function useUnallocatedGapFills(classId: string) {
  return useQuery({
    queryKey: key(classId),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/unallocated-gap-fills`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; data?: { gradeId: string; fills: UnallocatedGapFillRow[] } }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(
          (json as { error?: string })?.error || "Failed to load unallocated labels"
        );
      }
      return json.data;
    },
    enabled: Boolean(classId),
    staleTime: 15_000,
  });
}

export function useSaveUnallocatedGapFill(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      /** null clears */
      presetCode: string | null;
    }) => {
      const res = await fetch(
        `/api/admin/classes/${encodeURIComponent(classId)}/timetable/unallocated-gap-fills`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayOfWeek: input.dayOfWeek,
            startTime: input.startTime,
            endTime: input.endTime,
            presetCode: input.presetCode,
          }),
        }
      );
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save");
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(classId) });
    },
  });
}

export function findFillForGap(
  fills: UnallocatedGapFillRow[] | undefined,
  dayOfWeek: number,
  startTime: string,
  endTime: string
): UnallocatedGapFillRow | undefined {
  if (!fills?.length) return undefined;
  const s = startTime.trim();
  const e = endTime.trim();
  return fills.find(
    (f) => f.dayOfWeek === dayOfWeek && f.startTime === s && f.endTime === e
  );
}
