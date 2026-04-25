"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LeoSchoolSettingsResponse = {
  access: {
    effectiveEnabled: boolean;
    reason: string;
    reasonDetail?: string;
    schoolLeo: Record<string, unknown>;
  };
  canSchoolEdit: boolean;
  leo: Record<string, unknown>;
  platform: { allowSchoolSelfService: boolean };
};

export function useLeoSchoolSettings() {
  return useQuery({
    queryKey: ["leo", "school-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/leo/settings", { cache: "no-store" });
      const json = (await res.json()) as {
        success: boolean;
        data?: LeoSchoolSettingsResponse;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Failed to load Leo school settings");
      }
      return json.data;
    },
    staleTime: 20_000,
    meta: { suppressGlobalBusy: true },
  });
}

export function useUpdateLeoSchoolSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/admin/leo/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leo", "school-settings"] });
      void qc.invalidateQueries({ queryKey: ["leo", "bootstrap"] });
    },
    meta: { suppressGlobalBusy: true },
  });
}
