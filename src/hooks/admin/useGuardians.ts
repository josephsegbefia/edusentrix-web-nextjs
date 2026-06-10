// src/hooks/admin/useGuardians.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type GuardianRelationship =
  | "mother"
  | "father"
  | "guardian"
  | "step_mother"
  | "step_father"
  | "grandmother"
  | "grandfather"
  | "aunt"
  | "uncle"
  | "other";

export type GuardianData = {
  id: string;
  userId: string;
  fullName: string;
  relationship: GuardianRelationship;
  phone: string;
  email: string;
  occupation: string | null;
  photoUrl: string | null;
  isPrimary: boolean;
  createdAt: string;
  /** False until the parent accepts the invite and Clerk links their account */
  hasPlatformAccount: boolean;
};

export type GuardianSiblingCandidate = {
  studentId: string;
  studentName: string;
  gradeName: string | null;
  classGroupName: string | null;
  relationship: GuardianRelationship;
  isPrimary: boolean;
};

export type ExistingGuardianSearchResult = {
  guardian: GuardianData;
  alreadyLinked: boolean;
  siblingCandidates: GuardianSiblingCandidate[];
};

export type CreateGuardianInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  relationship: GuardianRelationship;
  occupation?: string | null;
  photoUrl?: string | null;
  isPrimary: boolean;
};

export type UpdateGuardianInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  relationship?: GuardianRelationship;
  occupation?: string | null;
  photoUrl?: string | null;
  isPrimary?: boolean;
};

export type LinkExistingGuardianInput = {
  userId: string;
  relationship: GuardianRelationship;
  phone?: string | null;
  occupation?: string | null;
  isPrimary: boolean;
};

async function readApiError(res: Response, fallback: string) {
  const text = await res.text().catch(() => "");
  if (!text) return `${fallback} (${res.status})`;
  try {
    const json = JSON.parse(text) as { error?: string };
    return json.error || `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

// Fetch guardians for a student
export function useGuardians(studentId: string | undefined) {
  return useQuery<GuardianData[]>({
    queryKey: ["guardians", studentId],
    queryFn: async () => {
      if (!studentId) throw new Error("Student ID is required");

      const res = await fetch(
        `/api/admin/students/${encodeURIComponent(studentId)}/guardians`
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch guardians");
      }
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!studentId,
    staleTime: 30_000,
  });
}

// Create guardian mutation
export function useCreateGuardian(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGuardianInput) => {
      if (!studentId) throw new Error("Student ID is required");

      const res = await fetch(
        `/api/admin/students/${encodeURIComponent(studentId)}/guardians`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create guardian");
      }

      return (await res.json()).data as GuardianData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
    },
  });
}

export function useExistingGuardianSearch(studentId: string | undefined, query: string) {
  return useQuery<ExistingGuardianSearchResult[]>({
    queryKey: ["guardians", studentId, "search-existing", query],
    queryFn: async () => {
      if (!studentId) throw new Error("Student ID is required");
      const params = new URLSearchParams({ q: query });
      const res = await fetch(
        `/api/admin/students/${encodeURIComponent(
          studentId
        )}/guardians/search-existing?${params.toString()}`
      );
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || "Failed to search existing guardians");
      }
      const data = await res.json();
      return data.data || [];
    },
    enabled: Boolean(studentId && query.trim().length >= 2),
    staleTime: 15_000,
  });
}

export function useLinkExistingGuardian(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LinkExistingGuardianInput) => {
      if (!studentId) throw new Error("Student ID is required");

      const res = await fetch(
        `/api/admin/students/${encodeURIComponent(studentId)}/guardians`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, mode: "link_existing" }),
        }
      );

      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to link existing guardian"));
      }

      return (await res.json()).data as {
        guardian: GuardianData;
        siblingCandidates: GuardianSiblingCandidate[];
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["guardians", studentId, "search-existing"] });
    },
  });
}

// Update guardian mutation
export function useUpdateGuardian(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      guardianId,
      input,
    }: {
      guardianId: string;
      input: UpdateGuardianInput;
    }) => {
      if (!studentId) throw new Error("Student ID is required");

      const res = await fetch(
        `/api/admin/students/${encodeURIComponent(
          studentId
        )}/guardians/${encodeURIComponent(guardianId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update guardian");
      }

      return (await res.json()).data as GuardianData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
    },
  });
}

// Delete guardian mutation
export function useDeleteGuardian(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guardianId: string) => {
      if (!studentId) throw new Error("Student ID is required");

      const res = await fetch(
        `/api/admin/students/${encodeURIComponent(
          studentId
        )}/guardians/${encodeURIComponent(guardianId)}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete guardian");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
    },
  });
}

// Set primary guardian mutation
export function useSetPrimaryGuardian(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guardianId: string) => {
      if (!studentId) throw new Error("Student ID is required");

      const res = await fetch(
        `/api/admin/students/${encodeURIComponent(
          studentId
        )}/guardians/${encodeURIComponent(guardianId)}/set-primary`,
        {
          method: "PATCH",
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to set primary guardian");
      }

      return (await res.json()).data as GuardianData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
    },
  });
}
