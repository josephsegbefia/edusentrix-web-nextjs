import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type DelegationListRow = {
  id: string;
  staffUserId: string;
  staffName: string;
  staffEmail: string;
  module: string;
  moduleLabel: string;
  preset: string;
  status: string;
  expiresAt: string | null;
  grantedByName: string;
  grantNote: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DelegationModuleInfo = {
  id: string;
  label: string;
  description: string;
  adminHref: string;
  presets: Array<{ id: string; label: string; description: string }>;
};

export type EligibleStaffRow = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  isTeacher: boolean;
  hasTeacherRecord: boolean;
};

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data as T;
}

export function useDelegationModules() {
  return useQuery({
    queryKey: ["admin-delegation-modules"],
    queryFn: async () => {
      const res = await fetch("/api/admin/delegations/modules", { cache: "no-store" });
      return parseJson<DelegationModuleInfo[]>(res);
    },
    staleTime: 60_000,
  });
}

export function useEligibleDelegationStaff() {
  return useQuery({
    queryKey: ["admin-delegation-eligible-staff"],
    queryFn: async () => {
      const res = await fetch("/api/admin/delegations/eligible-staff", { cache: "no-store" });
      return parseJson<EligibleStaffRow[]>(res);
    },
    staleTime: 60_000,
  });
}

export function useDelegationList(params: { status: string; module: string | null }) {
  return useQuery({
    queryKey: ["admin-delegations", params.status, params.module],
    queryFn: async () => {
      const sp = new URLSearchParams({ status: params.status });
      if (params.module) sp.set("module", params.module);
      const res = await fetch(`/api/admin/delegations?${sp}`, { cache: "no-store" });
      return parseJson<DelegationListRow[]>(res);
    },
  });
}

export function useCreateDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      staffUserId: string;
      module: string;
      preset: string;
      expiresAt: string | null;
      note: string | null;
    }) => {
      const res = await fetch("/api/admin/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await parseJson<{ id: string }>(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-delegations"] });
      void qc.invalidateQueries({ queryKey: ["admin-delegation-activity"] });
    },
  });
}

export function usePatchDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      delegationId: string;
      preset?: string;
      expiresAt?: string | null;
      note?: string | null;
    }) => {
      const { delegationId, ...body } = args;
      const res = await fetch(`/api/admin/delegations/${delegationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await parseJson<unknown>(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-delegations"] });
      void qc.invalidateQueries({ queryKey: ["admin-delegation-activity"] });
    },
  });
}

export type DelegationActivityRow = {
  id: string;
  type: string;
  description: string;
  userId: string;
  performedBy: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export function useDelegationActivity() {
  return useQuery({
    queryKey: ["admin-delegation-activity"],
    queryFn: async () => {
      const res = await fetch("/api/admin/delegations/activity", { cache: "no-store" });
      return parseJson<DelegationActivityRow[]>(res);
    },
    staleTime: 30_000,
  });
}

export function useRevokeDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { delegationId: string; reason: string | null }) => {
      const res = await fetch(`/api/admin/delegations/${args.delegationId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: args.reason }),
      });
      await parseJson<unknown>(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-delegations"] });
      void qc.invalidateQueries({ queryKey: ["admin-delegation-activity"] });
    },
  });
}
