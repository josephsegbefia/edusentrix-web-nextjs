import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SchemeRow } from "@/types/schemes";

type SchemesResponse = { success: boolean; data: { schemes: SchemeRow[] }; error?: string };

export function useAdminSchemes(status?: string) {
  return useQuery<SchemeRow[]>({
    queryKey: ["admin-schemes", status || "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/schemes?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as SchemesResponse | null;
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to fetch schemes");
      return json.data.schemes;
    },
    staleTime: 30_000,
  });
}

export function useAdminSchemeStatusAction(action: "approve" | "activate" | "archive") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schemeId: string) => {
      const res = await fetch(`/api/admin/schemes/${schemeId}/${action}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || `Failed to ${action} scheme`);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-schemes"] });
    },
  });
}
