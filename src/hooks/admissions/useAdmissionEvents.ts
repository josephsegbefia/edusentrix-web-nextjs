import { useQuery } from "@tanstack/react-query";

export type AdmissionEventDTO = {
  id: string;
  kind: string;
  at: string;
  applicationId: string | null;
  actor: {
    userId: string | null;
    role: string | null;
    label: string;
  };
  metadata: Record<string, unknown>;
};

async function jsonOrThrow(res: Response) {
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || "Request failed");
  }
  return json;
}

export function useAdmissionEvents(input: {
  cycleId: string;
  applicationId?: string | null;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (input.applicationId) params.set("applicationId", input.applicationId);
  if (input.limit) params.set("limit", String(input.limit));
  return useQuery<{
    data: { items: AdmissionEventDTO[]; nextCursor: string | null };
  }>({
    queryKey: [
      "admissions",
      "events",
      input.cycleId,
      input.applicationId ?? "",
      input.limit ?? 50,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/admissions/cycles/${input.cycleId}/events?${params.toString()}`,
        { cache: "no-store" }
      );
      return jsonOrThrow(res);
    },
    enabled: Boolean(input.cycleId),
    staleTime: 10_000,
  });
}
