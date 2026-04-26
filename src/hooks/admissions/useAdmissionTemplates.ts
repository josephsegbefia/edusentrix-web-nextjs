import { useQuery } from "@tanstack/react-query";

export type AdmissionCycleTemplateDTO = {
  id: "blank" | "standard_primary" | "standard_shs";
  label: string;
  description: string;
  defaults: { waitlistEnabled: boolean; welcomeMessage?: string };
  previewCounts: { sections: number; fields: number; documents: number };
};

async function jsonOrThrow(res: Response) {
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || "Request failed");
  }
  return json;
}

export function useAdmissionCycleTemplates() {
  return useQuery<{ data: AdmissionCycleTemplateDTO[] }>({
    queryKey: ["admissions", "templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/admissions/templates", {
        cache: "no-store",
      });
      return jsonOrThrow(res);
    },
    staleTime: 5 * 60 * 1000,
  });
}
