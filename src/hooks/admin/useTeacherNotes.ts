// src/hooks/admin/useTeacherNotes.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type TeacherNoteCategory =
  | "general"
  | "performance"
  | "behavior"
  | "professional_development"
  | "disciplinary"
  | "other";

export type TeacherNoteVisibility = "internal" | "private";

export type TeacherNoteDTO = {
  id: string;
  title: string;
  content: string;
  category: TeacherNoteCategory | null;
  visibility: TeacherNoteVisibility;
  isConfidential: boolean;
  tags: string[];
  createdBy: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherNotesResponse = {
  success: boolean;
  data: TeacherNoteDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateNoteInput = {
  title: string;
  content: string;
  category?: TeacherNoteCategory;
  visibility?: TeacherNoteVisibility;
  tags?: string[];
};

export type CreateNoteResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    title: string;
  };
};

export type UpdateNoteInput = {
  title?: string;
  content?: string;
  category?: TeacherNoteCategory;
  visibility?: TeacherNoteVisibility;
  tags?: string[];
};

export type UpdateNoteResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
  };
};

export type DeleteNoteResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
  };
};

export type NotesFilters = {
  category?: TeacherNoteCategory;
  page?: number;
  limit?: number;
};

/**
 * useTeacherNotes - Query hook for fetching teacher notes
 */
export function useTeacherNotes(
  teacherId: string,
  filters?: NotesFilters
) {
  return useQuery<TeacherNotesResponse>({
    queryKey: [
      "teachers",
      "notes",
      teacherId,
      filters || {},
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.set("category", filters.category);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));

      const res = await fetch(
        `/api/admin/teachers/${teacherId}/notes?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher notes");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

/**
 * useCreateNote - Mutation hook for creating a note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      payload,
    }: {
      teacherId: string;
      payload: CreateNoteInput;
    }): Promise<CreateNoteResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to create note" }));
        throw new Error(error.error || "Failed to create note");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "notes", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
    },
  });
}

/**
 * useUpdateNote - Mutation hook for updating a note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      noteId,
      payload,
    }: {
      teacherId: string;
      noteId: string;
      payload: UpdateNoteInput;
    }): Promise<UpdateNoteResponse> => {
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/notes/${noteId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to update note" }));
        throw new Error(error.error || "Failed to update note");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "notes", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
    },
  });
}

/**
 * useDeleteNote - Mutation hook for deleting a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      noteId,
    }: {
      teacherId: string;
      noteId: string;
    }): Promise<DeleteNoteResponse> => {
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/notes/${noteId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to delete note" }));
        throw new Error(error.error || "Failed to delete note");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "notes", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
    },
  });
}
