// src/hooks/admin/useCommunityPolls.ts
/**
 * React Query hooks for Community Polls management.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Types
// ============================================================================

export type PollStatus = "draft" | "pending_approval" | "approved" | "live" | "closed" | "archived";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
export type QuestionType = "single_choice" | "multi_choice" | "ranked_choice" | "likert" | "yes_no" | "comment";
export type RevealResults = "live" | "after_close" | "admin_only";
export type AudienceScope = "school" | "grade" | "class" | "staff" | "parents" | "students";

export interface PollOptionDTO {
  id: string;
  label: string;
  imageUrl: string | null;
  order: number;
}

export interface PollQuestionDTO {
  id: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  allowOther: boolean;
  order: number;
  options: PollOptionDTO[];
}

export interface PollAudienceDTO {
  scope: AudienceScope;
  gradeIds?: string[];
  classGroupIds?: string[];
  roles?: string[];
}

export interface PollScheduleDTO {
  startDate: string | null;
  endDate: string | null;
  timezone: string;
}

export interface PollListItemDTO {
  id: string;
  templateId?: string | null;
  title: string;
  description: string | null;
  status: PollStatus;
  approvalStatus: ApprovalStatus;
  audience: PollAudienceDTO;
  schedule: PollScheduleDTO;
  questionCount: number;
  totalVotes: number;
  participationRate: number;
  minResponseRate: number;
  revealResults: RevealResults;
  allowAnonymous: boolean;
  allowComments: boolean;
  coverImageUrl: string | null;
  tags: string[];
  createdBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdByRole: string;
  approvedBy: {
    id: string;
    name: string;
  } | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PollDetailDTO extends PollListItemDTO {
  questions: PollQuestionDTO[];
  approvalNotes: string | null;
  eligibleCount: number;
}

export interface PollResultsDTO {
  pollId: string;
  title: string;
  status: PollStatus;
  totalVotes: number;
  eligibleCount: number;
  participationRate: number;
  roleBreakdown: Record<string, number>;
  questions: PollQuestionResultDTO[];
}

export interface PollQuestionResultDTO {
  questionId: string;
  prompt: string;
  type: QuestionType;
  totalResponses: number;
  options?: Array<{
    optionId: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  otherResponses?: string[];
  distribution?: Record<number, number>;
  average?: number | null;
  yes?: number;
  no?: number;
  yesPercentage?: number;
  noPercentage?: number;
  responses?: string[];
}

interface PollsListResponse {
  data: PollListItemDTO[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Query Hooks
// ============================================================================

export function useCommunityPolls(params?: {
  status?: PollStatus;
  scope?: AudienceScope;
  limit?: number;
  skip?: number;
}) {
  return useQuery<PollsListResponse>({
    queryKey: ["community-polls", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.scope) searchParams.set("scope", params.scope);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.skip) searchParams.set("skip", String(params.skip));

      const res = await fetch(`/api/admin/community/polls?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch polls");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useCommunityPoll(pollId: string | undefined) {
  return useQuery<PollDetailDTO>({
    queryKey: ["community-poll", pollId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/community/polls/${pollId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch poll");
      return res.json();
    },
    enabled: !!pollId,
    staleTime: 30_000,
  });
}

export function usePollResults(pollId: string | undefined) {
  return useQuery<PollResultsDTO>({
    queryKey: ["community-poll-results", pollId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/community/polls/${pollId}/results`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch poll results");
      return res.json();
    },
    enabled: !!pollId,
    staleTime: 30_000,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useCreatePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      templateId?: string | null;
      title: string;
      description?: string;
      coverImageUrl?: string | null;
      tags?: string[];
      schedule?: {
        startDate?: string | null;
        endDate?: string | null;
        timezone?: string;
      };
      audience: {
        scope: AudienceScope;
        gradeIds?: string[];
        classGroupIds?: string[];
        roles?: string[];
      };
      questions: Array<{
        prompt: string;
        type: QuestionType;
        options?: Array<{
          label: string;
          imageUrl?: string | null;
          order?: number;
        }>;
        required?: boolean;
        allowOther?: boolean;
        order?: number;
      }>;
      allowAnonymous?: boolean;
      allowComments?: boolean;
      revealResults?: RevealResults;
      minResponseRate?: number;
    }) => {
      const res = await fetch("/api/admin/community/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create poll");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-polls"] });
    },
  });
}

export function useUpdatePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pollId, data }: { pollId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/community/polls/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update poll");
      }
      return res.json();
    },
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: ["community-polls"] });
      queryClient.invalidateQueries({ queryKey: ["community-poll", pollId] });
    },
  });
}

export function useDeletePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pollId: string) => {
      const res = await fetch(`/api/admin/community/polls/${pollId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete poll");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-polls"] });
    },
  });
}

export function usePublishPoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pollId: string) => {
      const res = await fetch(`/api/admin/community/polls/${pollId}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to publish poll");
      }
      return res.json();
    },
    onSuccess: (_, pollId) => {
      queryClient.invalidateQueries({ queryKey: ["community-polls"] });
      queryClient.invalidateQueries({ queryKey: ["community-poll", pollId] });
    },
  });
}

export function useClosePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pollId: string) => {
      const res = await fetch(`/api/admin/community/polls/${pollId}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to close poll");
      }
      return res.json();
    },
    onSuccess: (_, pollId) => {
      queryClient.invalidateQueries({ queryKey: ["community-polls"] });
      queryClient.invalidateQueries({ queryKey: ["community-poll", pollId] });
    },
  });
}

export function useApprovePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pollId: string) => {
      const res = await fetch(`/api/admin/community/polls/${pollId}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve poll");
      }
      return res.json();
    },
    onSuccess: (_, pollId) => {
      queryClient.invalidateQueries({ queryKey: ["community-polls"] });
      queryClient.invalidateQueries({ queryKey: ["community-poll", pollId] });
    },
  });
}

export function useRejectPoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pollId, reason }: { pollId: string; reason: string }) => {
      const res = await fetch(`/api/admin/community/polls/${pollId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reject poll");
      }
      return res.json();
    },
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: ["community-polls"] });
      queryClient.invalidateQueries({ queryKey: ["community-poll", pollId] });
    },
  });
}

export function useExportPollResults() {
  return useMutation({
    mutationFn: async (pollId: string) => {
      const res = await fetch(`/api/admin/community/polls/${pollId}/export`, {
        method: "GET",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error(error.error || "Failed to export poll results");
      }
      // Trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = res.headers.get("Content-Disposition");
      const fileName = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "") || "poll-results.csv"
        : "poll-results.csv";
      
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    },
  });
}
