import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Types
// ============================================================================

export type ApprovalAction = "submit" | "approve" | "reject" | "return_to_draft";

export interface ApprovalActionPayload {
  noteId: string;
  action: ApprovalAction;
  reason?: string; // For reject
  feedback?: string; // For approve
}

export interface ApprovalStatus {
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReturnToDraft: boolean;
}

export interface ApprovalResponse {
  success: boolean;
  message?: string;
  data?: {
    status: string;
    rejectionReason?: string;
  };
  error?: string;
}

// ============================================================================
// useApprovalStatus - Fetch approval status for a lesson note
// ============================================================================

export function useApprovalStatus(noteId: string | null, enabled = true) {
  return useQuery<ApprovalStatus>({
    queryKey: ["lesson-note-approval", noteId],
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID required");
      
      const res = await fetch(`/api/teacher/lesson-notes/${noteId}/approval`, {
        cache: "no-store",
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch approval status");
      }
      
      const json = await res.json();
      return json.data;
    },
    enabled: enabled && !!noteId,
    staleTime: 30_000,
  });
}

// ============================================================================
// useSubmitForApproval - Submit a lesson note for approval
// ============================================================================

export function useSubmitForApproval() {
  const qc = useQueryClient();

  return useMutation<ApprovalResponse, Error, string>({
    mutationFn: async (noteId: string) => {
      const res = await fetch(`/api/teacher/lesson-notes/${noteId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit for approval");
      }
      return data;
    },
    onSuccess: (_, noteId) => {
      qc.invalidateQueries({ queryKey: ["teacher-lesson-notes"] });
      qc.invalidateQueries({ queryKey: ["lesson-note-approval", noteId] });
    },
  });
}

// ============================================================================
// useApproveLessonNote - Approve a submitted lesson note
// ============================================================================

export function useApproveLessonNote() {
  const qc = useQueryClient();

  return useMutation<
    ApprovalResponse,
    Error,
    { noteId: string; feedback?: string }
  >({
    mutationFn: async ({ noteId, feedback }) => {
      const res = await fetch(`/api/teacher/lesson-notes/${noteId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", feedback }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to approve lesson note");
      }
      return data;
    },
    onSuccess: (_, { noteId }) => {
      qc.invalidateQueries({ queryKey: ["teacher-lesson-notes"] });
      qc.invalidateQueries({ queryKey: ["lesson-note-approval", noteId] });
    },
  });
}

// ============================================================================
// useRejectLessonNote - Reject a submitted lesson note
// ============================================================================

export function useRejectLessonNote() {
  const qc = useQueryClient();

  return useMutation<
    ApprovalResponse,
    Error,
    { noteId: string; reason: string }
  >({
    mutationFn: async ({ noteId, reason }) => {
      const res = await fetch(`/api/teacher/lesson-notes/${noteId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to reject lesson note");
      }
      return data;
    },
    onSuccess: (_, { noteId }) => {
      qc.invalidateQueries({ queryKey: ["teacher-lesson-notes"] });
      qc.invalidateQueries({ queryKey: ["lesson-note-approval", noteId] });
    },
  });
}

// ============================================================================
// useReturnToDraft - Return a lesson note to draft status
// ============================================================================

export function useReturnToDraft() {
  const qc = useQueryClient();

  return useMutation<ApprovalResponse, Error, string>({
    mutationFn: async (noteId: string) => {
      const res = await fetch(`/api/teacher/lesson-notes/${noteId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return_to_draft" }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to return to draft");
      }
      return data;
    },
    onSuccess: (_, noteId) => {
      qc.invalidateQueries({ queryKey: ["teacher-lesson-notes"] });
      qc.invalidateQueries({ queryKey: ["lesson-note-approval", noteId] });
    },
  });
}
