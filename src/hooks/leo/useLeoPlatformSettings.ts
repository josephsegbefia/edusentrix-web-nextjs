"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type LeoPlatformSettingsPayload = {
  key: string;
  runtimeServer: boolean;
  platform: {
    persisted: boolean;
    id: string | null;
    key: string;
    label: string;
    defaultState: "enabled" | "disabled";
    forcedMode: "none" | "force_enabled" | "force_disabled";
    allowSchoolOverride: boolean;
    allowSchoolSelfService: boolean;
    entitlementKey: string | null;
    rolloutNotes: string | null;
  };
};

export function useLeoPlatformSettings() {
  return useQuery({
    queryKey: ["leo", "platform-settings"],
    queryFn: async () => {
      const res = await fetch("/api/platform/leo/settings", { cache: "no-store" });
      const json = (await res.json()) as {
        success: boolean;
        data?: { key: string; runtimeServer: boolean; platform: LeoPlatformSettingsPayload["platform"] };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Failed to load platform Leo settings");
      }
      return {
        key: json.data.key,
        runtimeServer: json.data.runtimeServer,
        platform: json.data.platform,
      };
    },
    staleTime: 15_000,
    meta: { suppressGlobalBusy: true },
  });
}

export function useUpdateLeoPlatformSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      defaultState?: "enabled" | "disabled";
      forcedMode?: "none" | "force_enabled" | "force_disabled";
      allowSchoolOverride?: boolean;
      allowSchoolSelfService?: boolean;
      rolloutNotes?: string | null;
    }) => {
      const res = await fetch("/api/platform/leo/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; data?: unknown };
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update");
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leo", "platform-settings"] });
      void qc.invalidateQueries({ queryKey: ["leo", "bootstrap"] });
    },
    meta: { suppressGlobalBusy: true },
  });
}
