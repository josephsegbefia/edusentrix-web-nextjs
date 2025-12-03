import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "revoked"
  | "failed";

export type InvitationRole = "teacher" | "staff" | "school_admin";

export type Invitation = {
  _id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  clerkInvitationId?: string;
  sentAt: string;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  resendCount: number;
  lastResentAt?: string;
  invitedBy: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  } | null;
  metadata?: {
    firstName?: string;
    lastName?: string;
    subjectIds?: string[];
    homeroomClassGroupId?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
};

export type InvitationStats = {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
  revoked: number;
  failed: number;
  byRole: {
    teacher: number;
    staff: number;
    school_admin: number;
  };
};

type FetchInvitationsParams = {
  status?: InvitationStatus;
  role?: InvitationRole;
  search?: string;
  page?: number;
  limit?: number;
};

export function useInvitations(params: FetchInvitationsParams = {}) {
  const { status, role, search, page = 1, limit = 20 } = params;

  return useQuery<{
    data: Invitation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["invitations", status, role, search, page, limit],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (status) searchParams.set("status", status);
      if (role) searchParams.set("role", role);
      if (search) searchParams.set("search", search);
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));

      const res = await fetch(`/api/admin/invitations?${searchParams}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch invitations");
      const json = await res.json();
      return json;
    },
    staleTime: 30_000,
  });
}

export function useInvitationStats() {
  return useQuery<InvitationStats>({
    queryKey: ["invitations", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/invitations/stats", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch invitation stats");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60_000,
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(`/api/admin/invitations/${invitationId}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to resend invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(`/api/admin/invitations/${invitationId}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to revoke invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}

export function useDeleteInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(`/api/admin/invitations/${invitationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}
