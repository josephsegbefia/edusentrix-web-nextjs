// src/hooks/admin/useFundraisingCampaigns.ts
/**
 * React Query hooks for Fundraising Campaigns management.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Types
// ============================================================================

export type CampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "live"
  | "paused"
  | "closed"
  | "reconciled"
  | "archived";

export type CampaignApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
export type CampaignCategory = "school_project" | "emergency" | "pta_drive" | "student_cause" | "other";
export type CampaignAudienceScope = "school" | "grade" | "class" | "parents" | "staff";
export type DonorVisibility = "public_anonymous" | "public_named" | "admin_only";
export type DonationStatus = "pending" | "completed" | "failed" | "refunded";
export type PaymentMethod = "cash" | "bank_transfer" | "mobile_money" | "paystack" | "stripe" | "cheque" | "other";

export interface CampaignAudienceDTO {
  scope: CampaignAudienceScope;
  gradeIds?: string[];
  classGroupIds?: string[];
}

export interface CampaignScheduleDTO {
  startDate: string | null;
  endDate: string | null;
  timezone: string;
}

export interface CampaignMilestoneDTO {
  id: string;
  label: string;
  amountMinor: number;
  reachedAt: string | null;
}

export interface CampaignMatchingRuleDTO {
  id: string;
  matcherName: string;
  matchPercent: number;
  capMinor: number | null;
}

export interface CampaignPublicShareDTO {
  enabled: boolean;
  token?: string | null;
  expiresAt?: string | null;
}

export interface CampaignListItemDTO {
  id: string;
  title: string;
  summary: string | null;
  category: CampaignCategory;
  status: CampaignStatus;
  approvalStatus: CampaignApprovalStatus;
  coverImageUrl: string | null;
  goalAmountMinor: number;
  raisedAmountMinor: number;
  donorCount: number;
  currency: string;
  progressPercent: number;
  audience: CampaignAudienceDTO;
  schedule: CampaignScheduleDTO;
  donorVisibility: DonorVisibility;
  allowAnonymousDonations: boolean;
  publicShare: CampaignPublicShareDTO;
  tags: string[];
  createdBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetailDTO extends CampaignListItemDTO {
  description: string | null;
  galleryUrls: string[];
  documents: string[];
  approvalNotes: string | null;
  milestones: CampaignMilestoneDTO[];
  matchingRules: CampaignMatchingRuleDTO[];
  isRecurringEnabled: boolean;
  approvedBy: {
    id: string;
    name: string;
  } | null;
  approvedAt: string | null;
}

export interface DonationDTO {
  id: string;
  amountMinor: number;
  currency: string;
  status: DonationStatus;
  isAnonymous: boolean;
  donorName: string | null;
  donorEmail: string | null;
  donorPhone: string | null;
  donorUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  message: string | null;
  paymentMethod: PaymentMethod;
  receiptNumber: string | null;
  gatewayReference: string | null;
  createdAt: string;
  refundedAt: string | null;
}

interface CampaignsListResponse {
  data: CampaignListItemDTO[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

interface DonationsListResponse {
  data: DonationDTO[];
  totals: {
    raisedAmountMinor: number;
    donorCount: number;
    currency: string;
  };
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

export function useFundraisingCampaigns(params?: {
  status?: CampaignStatus;
  category?: CampaignCategory;
  limit?: number;
  skip?: number;
}) {
  return useQuery<CampaignsListResponse>({
    queryKey: ["fundraising-campaigns", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.category) searchParams.set("category", params.category);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.skip) searchParams.set("skip", String(params.skip));

      const res = await fetch(`/api/admin/community/fundraising?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useFundraisingCampaign(campaignId: string | undefined) {
  return useQuery<CampaignDetailDTO>({
    queryKey: ["fundraising-campaign", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/community/fundraising/${campaignId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch campaign");
      return res.json();
    },
    enabled: !!campaignId,
    staleTime: 30_000,
  });
}

export function useCampaignDonations(campaignId: string | undefined, params?: {
  status?: DonationStatus;
  limit?: number;
  skip?: number;
}) {
  return useQuery<DonationsListResponse>({
    queryKey: ["campaign-donations", campaignId, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.skip) searchParams.set("skip", String(params.skip));

      const res = await fetch(
        `/api/admin/community/fundraising/${campaignId}/donations?${searchParams.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch donations");
      return res.json();
    },
    enabled: !!campaignId,
    staleTime: 30_000,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      summary?: string;
      description?: string;
      category?: CampaignCategory;
      coverImageUrl?: string | null;
      galleryUrls?: string[];
      documents?: string[];
      tags?: string[];
      schedule?: {
        startDate?: string | null;
        endDate?: string | null;
        timezone?: string;
      };
      audience: {
        scope: CampaignAudienceScope;
        gradeIds?: string[];
        classGroupIds?: string[];
      };
      goalAmountMinor: number;
      currency?: string;
      milestones?: Array<{ label: string; amountMinor: number }>;
      matchingRules?: Array<{ matcherName: string; matchPercent: number; capMinor?: number }>;
      isRecurringEnabled?: boolean;
      allowAnonymousDonations?: boolean;
      donorVisibility?: DonorVisibility;
      publicShare?: { enabled: boolean };
    }) => {
      const res = await fetch("/api/admin/community/fundraising", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaigns"] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, data }: { campaignId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/community/fundraising/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update campaign");
      }
      return res.json();
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaign", campaignId] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/admin/community/fundraising/${campaignId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete campaign");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaigns"] });
    },
  });
}

export function usePublishCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/admin/community/fundraising/${campaignId}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to publish campaign");
      }
      return res.json();
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaign", campaignId] });
    },
  });
}

export function useCloseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/admin/community/fundraising/${campaignId}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to close campaign");
      }
      return res.json();
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaign", campaignId] });
    },
  });
}

export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/admin/community/fundraising/${campaignId}/pause`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to pause campaign");
      }
      return res.json();
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaign", campaignId] });
    },
  });
}

export function useApproveCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(`/api/admin/community/fundraising/${campaignId}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve campaign");
      }
      return res.json();
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaign", campaignId] });
    },
  });
}

export function useRejectCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, reason }: { campaignId: string; reason: string }) => {
      const res = await fetch(`/api/admin/community/fundraising/${campaignId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reject campaign");
      }
      return res.json();
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["fundraising-campaign", campaignId] });
    },
  });
}
