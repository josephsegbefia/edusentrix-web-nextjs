import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AdmissionCycleDTO = {
  id: string;
  schoolId: string;
  name: string;
  slug: string;
  intakeGradeIds: string[];
  targetAcademicPeriodId: string | null;
  acceptsApplicationsFrom: string;
  acceptsApplicationsUntil: string | null;
  decisionDueBy: string | null;
  status: "draft" | "published" | "paused" | "closed" | "archived";
  formId: string | null;
  capacityByGradeId: Record<string, number>;
  waitlistEnabled: boolean;
  applicationFee: {
    enabled: boolean;
    amountMinor: number;
    currency: string;
    mode: "manual_record" | "online_paystack";
    instructions?: string;
  } | null;
  acceptanceTemplate: {
    subject: string;
    htmlBody: string;
    replyToAlias?: string | null;
  };
  rejectionTemplate: {
    subject: string;
    htmlBody: string;
    replyToAlias?: string | null;
  };
  branding?: {
    heroImageUrl?: string | null;
    accentColor?: string | null;
    welcomeMessage?: string | null;
  };
  delegate: {
    userId: string;
    teacherId: string | null;
    assignedAt: string;
    assignedBy: string;
  } | null;
  analytics: {
    totalSubmissions: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
  };
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const cyclesQueryKey = ["admissions", "cycles"] as const;

async function jsonOrThrow(res: Response) {
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || "Request failed");
  }
  return json;
}

export function useAdmissionCycles() {
  return useQuery<{ data: AdmissionCycleDTO[] }>({
    queryKey: cyclesQueryKey,
    queryFn: async () => {
      const res = await fetch("/api/admin/admissions/cycles", {
        cache: "no-store",
      });
      return jsonOrThrow(res);
    },
    staleTime: 15_000,
  });
}

export function useAdmissionCycle(cycleId: string | null) {
  return useQuery<{ data: AdmissionCycleDTO }>({
    queryKey: ["admissions", "cycle", cycleId],
    queryFn: async () => {
      if (!cycleId) throw new Error("cycleId is required");
      const res = await fetch(
        `/api/admin/admissions/cycles/${cycleId}`,
        { cache: "no-store" }
      );
      return jsonOrThrow(res);
    },
    enabled: Boolean(cycleId),
    staleTime: 15_000,
  });
}

export type CreateAdmissionCycleInput = {
  name: string;
  slug: string;
  intakeGradeIds?: string[];
  targetAcademicPeriodId?: string | null;
  acceptsApplicationsFrom: string;
  acceptsApplicationsUntil?: string | null;
  decisionDueBy?: string | null;
  capacityByGradeId?: Record<string, number>;
  waitlistEnabled?: boolean;
  templateId?: "blank" | "standard_primary" | "standard_jhs" | "standard_shs";
};

export function useCreateAdmissionCycle() {
  const qc = useQueryClient();
  return useMutation<
    { data: AdmissionCycleDTO },
    Error,
    CreateAdmissionCycleInput
  >({
    mutationFn: async (input) => {
      const res = await fetch("/api/admin/admissions/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return jsonOrThrow(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cyclesQueryKey });
    },
  });
}

export function useUpdateAdmissionCycle() {
  const qc = useQueryClient();
  return useMutation<
    { data: AdmissionCycleDTO },
    Error,
    {
      cycleId: string;
      patch: Partial<CreateAdmissionCycleInput> & {
        acceptanceTemplate?: { subject: string; htmlBody: string };
        rejectionTemplate?: { subject: string; htmlBody: string };
      };
    }
  >({
    mutationFn: async ({ cycleId, patch }) => {
      const res = await fetch(`/api/admin/admissions/cycles/${cycleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      return jsonOrThrow(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: cyclesQueryKey });
      void qc.invalidateQueries({
        queryKey: ["admissions", "cycle", vars.cycleId],
      });
    },
  });
}

function makeTransitionMutation(action: "publish" | "pause" | "close") {
  return function useCycleTransition() {
    const qc = useQueryClient();
    return useMutation<{ data: AdmissionCycleDTO }, Error, { cycleId: string }>(
      {
        mutationFn: async ({ cycleId }) => {
          const res = await fetch(
            `/api/admin/admissions/cycles/${cycleId}/${action}`,
            { method: "POST" }
          );
          return jsonOrThrow(res);
        },
        onSuccess: (_data, vars) => {
          void qc.invalidateQueries({ queryKey: cyclesQueryKey });
          void qc.invalidateQueries({
            queryKey: ["admissions", "cycle", vars.cycleId],
          });
        },
      }
    );
  };
}

export const usePublishAdmissionCycle = makeTransitionMutation("publish");
export const usePauseAdmissionCycle = makeTransitionMutation("pause");
export const useCloseAdmissionCycle = makeTransitionMutation("close");
