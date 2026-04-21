import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSetupReadiness } from "@/lib/query/invalidate-setup-readiness";

export type SchoolPaymentSetupDTO = {
  schoolId: string;
  schoolName: string;
  /** Server Paystack API key mode — test subaccounts only show in Paystack test dashboard. */
  paystackKeyMode: "test" | "live" | "unset";
  accessMode:
    | "billing_owner"
    | "finance_delegate"
    | "school_creator"
    | "admin_fallback"
    | "school_admin_readonly";
  capabilities: {
    canView: boolean;
    canManage: boolean;
    canManageDelegate: boolean;
    canInviteOwner: boolean;
    canApprovePayoutChange: boolean;
  };
  paymentReady: boolean;
  status:
    | "not_started"
    | "awaiting_billing_owner"
    | "details_submitted"
    | "pending_provisioning"
    | "review_required"
    | "provisioned"
    | "failed";
  statusLabel: string;
  statusTone: "slate" | "amber" | "blue" | "emerald" | "red";
  statusDescription: string;
  canSubmitSetup: boolean;
  reviewReason: string | null;
  bank: {
    bankName: string;
    branchName: string;
    sortCode: string;
    accountName: string;
    accountNumber: string;
    maskedAccountNumber: string;
    /** True when a payout account exists in the database (full digits are not returned from GET until unmask). */
    hasAccountNumberOnFile: boolean;
  };
  missingFields: string[];
  billingOwner: {
    userId: string | null;
    name: string | null;
    email: string | null;
    assignedAt: string | null;
  };
  financeDelegate: {
    userId: string | null;
    name: string | null;
    email: string | null;
    assignedAt: string | null;
  };
  pendingInvitations: {
    billingOwner: {
      invitationId: string;
      email: string;
      name: string | null;
      mode: "initial" | "replacement";
      sentAt: string;
      expiresAt: string;
    } | null;
    financeDelegate: {
      invitationId: string;
      email: string;
      name: string | null;
      sentAt: string;
      expiresAt: string;
    } | null;
  };
  paystack: {
    subaccountCode: string | null;
    subaccountId: string | null;
    lastError: string | null;
  };
  provisioning: {
    status: "pending" | "running" | "failed" | "done";
    attempts: number;
    lastError: string | null;
    nextRunAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  timestamps: {
    submittedAt: string | null;
    approvedAt: string | null;
    lastUpdatedAt: string | null;
  };
  audit: {
    approvedByEmail: string | null;
  };
};

export type UpdateSchoolPaymentSetupInput = {
  bankName: string;
  branchName: string;
  accountName: string;
  accountNumber: string;
};

export type InviteBillingOwnerInput = {
  ownerName: string;
  ownerEmail: string;
};

export type InviteFinanceDelegateInput = {
  delegateName: string;
  delegateEmail: string;
};

type PaymentSetupResponse = {
  success?: boolean;
  error?: unknown;
  data?: SchoolPaymentSetupDTO;
};

async function fetchPaymentSetup(options?: { allowForbidden?: boolean }) {
  const res = await fetch("/api/admin/settings/payment-setup", {
    cache: "no-store",
  });
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  let json: unknown = null;

  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }

  const parsed =
    json && typeof json === "object" ? (json as PaymentSetupResponse) : null;

  if ((res.status === 401 || res.status === 403) && options?.allowForbidden) {
    return null;
  }

  if (!res.ok || !parsed?.success) {
    const apiMessage = String(parsed?.error || "").trim();

    if (apiMessage) {
      throw new Error(apiMessage);
    }

    if (contentType.includes("text/html")) {
      throw new Error(
        `Payment setup request returned HTML instead of JSON (${res.status}).`
      );
    }

    if (!raw.trim()) {
      throw new Error(
        `Payment setup request returned an empty response (${res.status}).`
      );
    }

    throw new Error(
      `Payment setup request failed (${res.status} ${res.statusText || "Unknown"}).`
    );
  }

  if (!parsed.data) {
    throw new Error("Payment setup response did not include data.");
  }

  return parsed.data;
}

export function useSchoolPaymentSetup(options?: { allowForbidden?: boolean }) {
  return useQuery<SchoolPaymentSetupDTO | null>({
    queryKey: ["school-payment-setup", options?.allowForbidden ?? false],
    queryFn: () => fetchPaymentSetup(options),
    staleTime: 30_000,
    retry: false,
  });
}

export function useUpdateSchoolPaymentSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSchoolPaymentSetupInput) => {
      const res = await fetch("/api/admin/settings/payment-setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save payout details");
      }
      const row = json.data as SchoolPaymentSetupDTO;
      return {
        ...row,
        bank: {
          ...row.bank,
          accountNumber: input.accountNumber,
          hasAccountNumberOnFile: true,
        },
      } satisfies SchoolPaymentSetupDTO;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<SchoolPaymentSetupDTO | null>(
        ["school-payment-setup", false],
        data
      );
      invalidateSetupReadiness(queryClient);
    },
  });
}

export function useRevealPayoutAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { reason: string }) => {
      const res = await fetch("/api/admin/settings/payment-setup/unmask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: input.reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : "Failed to reveal account number"
        );
      }
      return json.data as { accountNumber: string; maskedAccountNumber: string };
    },
    onSuccess: (reveal) => {
      queryClient.setQueryData<SchoolPaymentSetupDTO | null>(
        ["school-payment-setup", false],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            bank: {
              ...old.bank,
              accountNumber: reveal.accountNumber,
              maskedAccountNumber: reveal.maskedAccountNumber,
            },
          };
        }
      );
    },
  });
}

export function useStartSchoolPaymentProvisioning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/settings/payment-setup/provision", {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to start payment setup");
      }
      return json.data as {
        status: "provisioned" | "pending_provisioning";
        mode?: "sync" | "async_fallback";
        syncAttemptError?: string;
        jobStatus: "pending" | "running" | "failed" | "done";
        attempts: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-payment-setup"] });
      invalidateSetupReadiness(queryClient);
    },
  });
}

export function useInviteBillingOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteBillingOwnerInput) => {
      const res = await fetch("/api/admin/settings/payment-setup/owner-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to invite billing owner");
      }
      return json.data as {
        invitationId: string;
        email: string;
        role: "billing_owner";
        status: "pending";
        expiresAt: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-payment-setup"] });
    },
  });
}

export function useInviteFinanceDelegate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteFinanceDelegateInput) => {
      const res = await fetch("/api/admin/settings/payment-setup/delegate-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to invite finance delegate");
      }
      return json.data as {
        invitationId: string;
        email: string;
        role: "bursar";
        status: "pending";
        expiresAt: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-payment-setup"] });
    },
  });
}

export function useRemoveFinanceDelegate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/settings/payment-setup/delegate", {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to remove finance delegate");
      }
      return json.data as { cleared: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-payment-setup"] });
    },
  });
}
