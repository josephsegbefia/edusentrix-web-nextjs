import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExamVenueDTO } from "@/types/academics/exam-scheduling-engine";

export type ExamVenueBodyInput = {
  name: string;
  code?: string | null;
  type?: string;
  capacity?: number | null;
  locationNote?: string | null;
  isActive?: boolean;
};

type ExamVenueListResponse = {
  success: boolean;
  data: ExamVenueDTO[];
};

type ExamVenueResponse = {
  success: boolean;
  data: ExamVenueDTO;
  error?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function useExamVenues(filters?: { activeOnly?: boolean }) {
  return useQuery<ExamVenueListResponse>({
    queryKey: ["examVenues", filters?.activeOnly ? "active" : "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.activeOnly) params.set("activeOnly", "true");
      const query = params.toString();
      const res = await fetch(
        `/api/admin/exams/venues${query ? `?${query}` : ""}`,
        { cache: "no-store" }
      );
      const json = await parseJson<{
        success?: boolean;
        error?: string;
        data?: ExamVenueDTO[];
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to fetch exam venues");
      }
      return { success: true, data: json.data ?? [] };
    },
  });
}

export function useCreateExamVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExamVenueBodyInput) => {
      const res = await fetch("/api/admin/exams/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<ExamVenueResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create exam venue");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examVenues"] });
    },
  });
}

export function useUpdateExamVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: Partial<ExamVenueBodyInput>;
    }) => {
      const res = await fetch(`/api/admin/exams/venues/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await parseJson<ExamVenueResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update exam venue");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examVenues"] });
    },
  });
}

export function useDeactivateExamVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/exams/venues/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await parseJson<ExamVenueResponse>(res);
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to deactivate exam venue");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examVenues"] });
    },
  });
}
