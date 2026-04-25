"use client";

import { useQuery } from "@tanstack/react-query";
import { isLeoCopilotClientRuntimeEnabled } from "@/lib/leo/runtime";
import type { LeoBootstrapDTO } from "@/lib/leo/types";

type BootstrapResponse = { success: true; data: LeoBootstrapDTO } | { success: false; error?: string };

export function useLeoBootstrap() {
  const clientRuntime = isLeoCopilotClientRuntimeEnabled();
  return useQuery({
    queryKey: ["leo", "bootstrap"],
    queryFn: async () => {
      const res = await fetch("/api/leo/bootstrap", { cache: "no-store" });
      if (res.status === 503) {
        return { success: false as const, data: null, featureDisabled: true as const };
      }
      const json = (await res.json()) as BootstrapResponse;
      if (!res.ok) {
        throw new Error("Failed to load Leo");
      }
      if (!("success" in json) || !json.success) {
        throw new Error("Failed to load Leo");
      }
      return { success: true as const, data: json.data, featureDisabled: false as const };
    },
    enabled: clientRuntime,
    staleTime: 30_000,
    retry: false,
    meta: { suppressGlobalBusy: true },
  });
}
