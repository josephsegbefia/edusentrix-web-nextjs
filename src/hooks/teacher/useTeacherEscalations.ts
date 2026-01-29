import { useQuery } from "@tanstack/react-query";

export type EscalationSummary = {
  id: string;
  type: "discipline" | "academic" | "welfare" | "other";
  title: string;
  description: string;
  status: "open" | "in_review" | "resolved" | "closed";
  student: { id: string; name: string; admissionNo?: string } | null;
  createdAt: string | null;
  resolvedAt: string | null;
};

export type TeacherEscalationsResponse = {
  success: boolean;
  data: {
    escalations: EscalationSummary[];
  };
};

export function useTeacherEscalations(status?: string) {
  return useQuery<TeacherEscalationsResponse>({
    queryKey: ["teacher-escalations", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const res = await fetch(`/api/teacher/escalations?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch escalations");
      }
      return data;
    },
    staleTime: 20_000,
  });
}
