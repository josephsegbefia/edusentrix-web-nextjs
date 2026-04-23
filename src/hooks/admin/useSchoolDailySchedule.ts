import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { prepareSchoolDailyConfigForApi } from "@/lib/school-day/migrate-v2";
import type { SchoolDailyScheduleConfigV2 } from "@/types/school-daily-schedule";

const KEY = ["admin", "school-daily-schedule"] as const;

export type SchoolScheduleHistoryItem = {
  id: number;
  revision: number;
  savedAt: string | null;
  savedBy: string | null;
  label: string | null;
  academicPeriodId: string | null;
  config: SchoolDailyScheduleConfigV2 | null;
};

export type SchoolDailyScheduleDTO = {
  id: string;
  config: SchoolDailyScheduleConfigV2;
  revision: number;
  history: SchoolScheduleHistoryItem[];
  updatedAt: string | null;
  createdAt?: string | null;
};

type GetResponse = { success: boolean; data: SchoolDailyScheduleDTO | null; error?: string };
type SaveResponse = {
  success: boolean;
  data?: {
    id: string;
    config: SchoolDailyScheduleConfigV2;
    revision?: number;
    warnings: string[];
    updatedAt?: string;
  };
  error?: string;
};

export type SaveSchoolDailyScheduleInput = {
  config: SchoolDailyScheduleConfigV2;
  changeLabel?: string;
  academicPeriodId?: string;
};

export function useSchoolDailySchedule() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch("/api/admin/school-daily-schedule", { cache: "no-store" });
      const json = (await res.json()) as GetResponse;
      if (!res.ok) {
        throw new Error(json.error || "Failed to load daily schedule");
      }
      return json.data;
    },
  });
}

export function useSaveSchoolDailySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ config, changeLabel, academicPeriodId }: SaveSchoolDailyScheduleInput) => {
      const res = await fetch("/api/admin/school-daily-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: prepareSchoolDailyConfigForApi(config),
          changeLabel: changeLabel?.trim() || undefined,
          academicPeriodId: academicPeriodId?.trim() || undefined,
        }),
      });
      const json = (await res.json()) as SaveResponse;
      if (!res.ok) {
        throw new Error(json.error || "Failed to save daily schedule");
      }
      if (!json.data) throw new Error("Invalid response");
      return json.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteSchoolDailySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/school-daily-schedule", { method: "DELETE" });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
