import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AdmissionApplicationListItem = {
  id: string;
  cycleId: string;
  referenceCode: string;
  status:
    | "submitted"
    | "under_review"
    | "interview_scheduled"
    | "accepted"
    | "rejected"
    | "waitlisted"
    | "withdrawn"
    | "expired";
  channel: string;
  feeStatus: string;
  submittedAt: string | null;
  applicant: {
    firstName: string;
    lastName: string;
    intendedGradeId: string | null;
    intendedGradeName: string | null;
    sex: "male" | "female" | null;
    dateOfBirth: string | null;
    photoUrl: string | null;
  };
  guardian: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    relationship: string | null;
  };
  documentsCount: number;
  hasDecision: boolean;
  provisioned: boolean;
  assignedReviewerId: string | null;
  trackerToken: string;
};

export type AdmissionApplicationDetail = AdmissionApplicationListItem & {
  formVersion: number;
  applicantAddress: string | null;
  guardianAddress: string | null;
  guardianOccupation: string | null;
  additional: Record<string, unknown>;
  documents: Array<{
    requirementId: string;
    label: string;
    fileUrl: string;
    fileName: string | null;
    sizeBytes: number | null;
    mimeType: string | null;
    uploadedAt: string;
  }>;
  decision: {
    outcome: "accepted" | "rejected" | "waitlisted";
    notes: string | null;
    decidedAt: string;
    targetGradeId: string | null;
    targetClassGroupId: string | null;
  } | null;
  notesPrivate: string | null;
  inviteCode: string | null;
  referrer: string | null;
  interviewAt: string | null;
  interviewEndsAt?: string | null;
  /** Present on newer API responses; treat as [] when missing (cached clients). */
  supplementalDocumentRequests?: Array<{
    id: string;
    token: string;
    label: string;
    message: string | null;
    requestedAt: string;
    fulfilledAt: string | null;
  }>;
};

export type ApplicationsListFilter = {
  cycleId?: string;
  status?: string;
  gradeId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

async function jsonOrThrow(res: Response) {
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || "Request failed");
  }
  return json;
}

export function useAdmissionApplications(filter: ApplicationsListFilter) {
  const params = new URLSearchParams();
  if (filter.cycleId) params.set("cycleId", filter.cycleId);
  if (filter.status) params.set("status", filter.status);
  if (filter.gradeId) params.set("gradeId", filter.gradeId);
  if (filter.q) params.set("q", filter.q);
  if (filter.page) params.set("page", String(filter.page));
  if (filter.pageSize) params.set("pageSize", String(filter.pageSize));

  return useQuery<{
    data: {
      items: AdmissionApplicationListItem[];
      page: number;
      pageSize: number;
      total: number;
      statusCounts: Record<string, number>;
    };
  }>({
    queryKey: ["admissions", "applications", params.toString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/admissions/applications?${params.toString()}`,
        { cache: "no-store" }
      );
      return jsonOrThrow(res);
    },
    staleTime: 10_000,
  });
}

export function useAdmissionApplication(applicationId: string | null) {
  return useQuery<{ data: AdmissionApplicationDetail }>({
    queryKey: ["admissions", "application", applicationId],
    queryFn: async () => {
      if (!applicationId) throw new Error("applicationId required");
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}`,
        { cache: "no-store" }
      );
      return jsonOrThrow(res);
    },
    enabled: Boolean(applicationId),
    staleTime: 10_000,
  });
}

export type UpdateApplicationInput = {
  status?:
    | "submitted"
    | "under_review"
    | "interview_scheduled"
    | "waitlisted"
    | "withdrawn"
    | "expired";
  assignedReviewerId?: string | null;
  notesPrivate?: string | null;
  feeStatus?: "not_required" | "pending" | "paid" | "waived";
  interviewAt?: string | null;
  interviewEndsAt?: string | null;
  /** Default true on the server when omitted. */
  notifyApplicant?: boolean;
};

export function useUpdateAdmissionApplication() {
  const qc = useQueryClient();
  return useMutation<
    { data: AdmissionApplicationDetail },
    Error,
    { applicationId: string; patch: UpdateApplicationInput }
  >({
    mutationFn: async ({ applicationId, patch }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      return jsonOrThrow(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["admissions", "applications"] });
      void qc.invalidateQueries({
        queryKey: ["admissions", "application", vars.applicationId],
      });
    },
  });
}

// -------------------------------------------------------------------------
// Phase 3 — decision, provisioning, withdraw, resend tracker, lookup
// -------------------------------------------------------------------------

export type AdmissionGradeOption = {
  id: string;
  name: string;
  level: number | null;
};

export type AdmissionClassGroupOption = {
  id: string;
  name: string;
  gradeId: string;
  capacity: number | null;
  enrolled: number;
  isFull: boolean;
};

export function useAdmissionsLookup(gradeId: string | null) {
  const params = new URLSearchParams();
  if (gradeId) params.set("gradeId", gradeId);
  return useQuery<{
    data: {
      grades: AdmissionGradeOption[];
      classGroups: AdmissionClassGroupOption[];
    };
  }>({
    queryKey: ["admissions", "lookup", gradeId ?? ""],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/admissions/lookup?${params.toString()}`,
        { cache: "no-store" }
      );
      return jsonOrThrow(res);
    },
    staleTime: 30_000,
  });
}

export type DecisionInput = {
  outcome: "accepted" | "rejected" | "waitlisted";
  notes?: string | null;
  targetGradeId?: string | null;
  targetClassGroupId?: string | null;
  sendEmail?: boolean;
};

export type DecisionResult = {
  applicationId: string;
  status: "accepted" | "rejected" | "waitlisted";
  decision: {
    outcome: "accepted" | "rejected" | "waitlisted";
    decidedAt: string;
    targetGradeId: string | null;
    targetClassGroupId: string | null;
    notes: string | null;
  };
  emailSent: boolean;
};

export function useDecideAdmissionApplication() {
  const qc = useQueryClient();
  return useMutation<
    { data: DecisionResult },
    Error,
    { applicationId: string; input: DecisionInput }
  >({
    mutationFn: async ({ applicationId, input }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      return jsonOrThrow(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["admissions", "applications"] });
      void qc.invalidateQueries({
        queryKey: ["admissions", "application", vars.applicationId],
      });
    },
  });
}

export type ProvisionInput = {
  targetClassGroupId?: string | null;
  targetGradeId?: string | null;
  sendParentInvite?: boolean;
};

export type ProvisionResult = {
  applicationId: string;
  studentId: string;
  guardianId: string;
  parentUserId: string;
  classGroupId: string;
  gradeId: string;
  invitedParent: boolean;
  alreadyProvisioned: boolean;
};

export function useProvisionAdmissionApplication() {
  const qc = useQueryClient();
  return useMutation<
    { data: ProvisionResult },
    Error,
    { applicationId: string; input: ProvisionInput }
  >({
    mutationFn: async ({ applicationId, input }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/provision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input ?? {}),
        }
      );
      return jsonOrThrow(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["admissions", "applications"] });
      void qc.invalidateQueries({
        queryKey: ["admissions", "application", vars.applicationId],
      });
    },
  });
}

export function useWithdrawAdmissionApplication() {
  const qc = useQueryClient();
  return useMutation<
    { data: { applicationId: string; status: "withdrawn" } },
    Error,
    { applicationId: string; reason?: string | null }
  >({
    mutationFn: async ({ applicationId, reason }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/withdraw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason ?? null }),
        }
      );
      return jsonOrThrow(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["admissions", "applications"] });
      void qc.invalidateQueries({
        queryKey: ["admissions", "application", vars.applicationId],
      });
    },
  });
}

export function useResendTrackerLink() {
  return useMutation<
    { data: { sentTo: string; trackerUrl: string } },
    Error,
    { applicationId: string }
  >({
    mutationFn: async ({ applicationId }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/resend-tracker-link`,
        { method: "POST" }
      );
      return jsonOrThrow(res);
    },
  });
}

export function useResendAdmissionReceivedEmail() {
  return useMutation<
    { data: { sentTo: string } },
    Error,
    { applicationId: string }
  >({
    mutationFn: async ({ applicationId }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/resend-received-email`,
        { method: "POST" }
      );
      return jsonOrThrow(res);
    },
  });
}

export function useResendAdmissionPipelineReminder() {
  return useMutation<
    { data: { sentTo: string } },
    Error,
    { applicationId: string }
  >({
    mutationFn: async ({ applicationId }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/resend-pipeline-reminder`,
        { method: "POST" }
      );
      return jsonOrThrow(res);
    },
  });
}

export function useSendAdmissionFeeLinkEmail() {
  return useMutation<
    { data: { sentTo: string } },
    Error,
    { applicationId: string }
  >({
    mutationFn: async ({ applicationId }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/send-fee-link-email`,
        { method: "POST" }
      );
      return jsonOrThrow(res);
    },
  });
}

export function useResendAdmissionInterviewEmail() {
  return useMutation<
    { data: { sentTo: string } },
    Error,
    { applicationId: string }
  >({
    mutationFn: async ({ applicationId }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/resend-interview-email`,
        { method: "POST" }
      );
      return jsonOrThrow(res);
    },
  });
}

export function useRequestSupplementalAdmissionDocument() {
  const qc = useQueryClient();
  return useMutation<
    {
      data: { uploadUrl: string; token: string; emailSent: boolean };
    },
    Error,
    {
      applicationId: string;
      label: string;
      message?: string | null;
      sendEmail?: boolean;
    }
  >({
    mutationFn: async ({ applicationId, label, message, sendEmail }) => {
      const res = await fetch(
        `/api/admin/admissions/applications/${applicationId}/request-supplemental-document`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, message: message ?? null, sendEmail }),
        }
      );
      return jsonOrThrow(res);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: ["admissions", "application", vars.applicationId],
      });
    },
  });
}

// -------------------------------------------------------------------------
// Phase 4 — bulk actions and export
// -------------------------------------------------------------------------

export type BulkUpdateInput =
  | {
      ids: string[];
      action: "set_status";
      status:
        | "submitted"
        | "under_review"
        | "interview_scheduled"
        | "waitlisted"
        | "expired";
    }
  | {
      ids: string[];
      action: "assign_reviewer";
      reviewerId: string | null;
    };

export type BulkUpdateResult = {
  updated: number;
  skipped: number;
  total: number;
};

export function useBulkUpdateApplications() {
  const qc = useQueryClient();
  return useMutation<{ data: BulkUpdateResult }, Error, BulkUpdateInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/admin/admissions/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return jsonOrThrow(res);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admissions", "applications"] });
    },
  });
}

export type ExportApplicationsInput = {
  ids?: string[];
  cycleId?: string;
  status?: string;
};

/**
 * Trigger a CSV download of selected applications.
 * Returns the count of rows exported on success.
 */
export async function exportApplicationsToCsv(
  input: ExportApplicationsInput
): Promise<number> {
  const res = await fetch("/api/admin/admissions/applications/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || "Export failed");
  }
  const blob = await res.blob();
  const text = await blob.text();
  const lines = text.split("\n").filter(Boolean);
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `admissions-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Math.max(0, lines.length - 1);
}
