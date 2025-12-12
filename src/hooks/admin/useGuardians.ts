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
  phone?: string | null;
  relationship?: GuardianRelationship;
  occupation?: string | null;
  photoUrl?: string | null;
  isPrimary?: boolean;
};

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
