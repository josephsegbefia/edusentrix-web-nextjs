// src/hooks/admin/useTeacherDocuments.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type TeacherDocumentType =
  | "contract"
  | "certificate"
  | "license"
  | "id"
  | "resume"
  | "other";

export type TeacherDocumentDTO = {
  id: string;
  name: string;
  type: TeacherDocumentType;
  category: string | null;
  fileUrl: string;
  fileMime: string | null;
  fileSize: number | null;
  tags: string[];
  notes: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  expiryStatus: "expired" | "expiring_soon" | "valid" | null;
  createdBy: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherDocumentsResponse = {
  success: boolean;
  data: TeacherDocumentDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type UploadDocumentInput = {
  name: string;
  type: TeacherDocumentType;
  category?: string | null;
  fileUrl: string;
  fileMime?: string | null;
  fileSize?: number | null;
  tags?: string[];
  notes?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
};

export type UploadDocumentResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    type: TeacherDocumentType;
  };
};

export type DocumentDownloadResponse = {
  success: boolean;
  data: {
    id: string;
    name: string;
    type: TeacherDocumentType;
    fileUrl: string;
    fileMime: string | null;
    fileSize: number | null;
  };
};

export type DeleteDocumentResponse = {
  success: boolean;
  message: string;
  data: {
    id: string;
  };
};

export type ExpiringDocumentDTO = {
  id: string;
  name: string;
  type: TeacherDocumentType;
  category: string | null;
  fileUrl: string;
  expiryDate: string;
  daysUntilExpiry: number;
  expiryStatus?: "expired" | "expiring_soon" | "valid";
  teacher: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  createdAt: string;
};

export type ExpiringDocumentsResponse = {
  success: boolean;
  data: ExpiringDocumentDTO[];
  meta: {
    daysAhead: number;
    count: number;
  };
};

export type DocumentFilters = {
  type?: TeacherDocumentType;
  category?: string;
  page?: number;
  limit?: number;
};

/**
 * useTeacherDocuments - Query hook for fetching teacher documents
 */
export function useTeacherDocuments(
  teacherId: string,
  filters?: DocumentFilters
) {
  return useQuery<TeacherDocumentsResponse>({
    queryKey: [
      "teachers",
      "documents",
      teacherId,
      filters || {},
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set("type", filters.type);
      if (filters?.category) params.set("category", filters.category);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));

      const res = await fetch(
        `/api/admin/teachers/${teacherId}/documents?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher documents");
      return res.json();
    },
    enabled: !!teacherId,
    staleTime: 30_000,
  });
}

/**
 * useUploadDocument - Mutation hook for uploading a document
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      payload,
    }: {
      teacherId: string;
      payload: UploadDocumentInput;
    }): Promise<UploadDocumentResponse> => {
      const res = await fetch(`/api/admin/teachers/${teacherId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to upload document" }));
        throw new Error(error.error || "Failed to upload document");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "documents", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
    },
  });
}

/**
 * useDeleteDocument - Mutation hook for deleting a document
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teacherId,
      documentId,
    }: {
      teacherId: string;
      documentId: string;
    }): Promise<DeleteDocumentResponse> => {
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/documents/${documentId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to delete document" }));
        throw new Error(error.error || "Failed to delete document");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teachers", "documents", variables.teacherId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers", "detail", variables.teacherId],
      });
    },
  });
}

/**
 * useDocumentDownload - Query hook for getting document download info
 */
export function useDocumentDownload(
  teacherId: string,
  documentId: string,
  enabled = true
) {
  return useQuery<DocumentDownloadResponse>({
    queryKey: ["teachers", "documents", teacherId, documentId, "download"],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/teachers/${teacherId}/documents/${documentId}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch document");
      return res.json();
    },
    enabled: !!teacherId && !!documentId && enabled,
    staleTime: 60_000, // Cache download info for 1 minute
  });
}

/**
 * useExpiringDocuments - Query hook for fetching expiring documents
 */
export type SchoolTeacherDocumentDTO = {
  id: string;
  name: string;
  type: TeacherDocumentType;
  category: string | null;
  fileUrl: string;
  expiryDate: string | null;
  expiryStatus: "expired" | "expiring_soon" | "valid" | null;
  teacher: { id: string; name: string; email: string | null } | null;
  createdAt: string;
};

export type SchoolTeacherDocumentsResponse = {
  success: boolean;
  data: SchoolTeacherDocumentDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

/**
 * useSchoolTeacherDocuments - Query hook for school-wide teacher documents
 */
export function useSchoolTeacherDocuments(filters?: {
  type?: TeacherDocumentType;
  teacherId?: string;
  page?: number;
  limit?: number;
  sortBy?: "expiryDate" | "createdAt";
  sortOrder?: "asc" | "desc";
}) {
  return useQuery<SchoolTeacherDocumentsResponse>({
    queryKey: ["documents", "teachers", filters || {}],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set("type", filters.type);
      if (filters?.teacherId) params.set("teacherId", filters.teacherId);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.sortBy) params.set("sortBy", filters.sortBy);
      if (filters?.sortOrder) params.set("sortOrder", filters.sortOrder);

      const res = await fetch(
        `/api/admin/documents/teachers?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch teacher documents");
      return res.json();
    },
    staleTime: 60_000,
  });
}

/**
 * useExpiringDocuments - Query hook for fetching expiring documents
 */
export function useExpiringDocuments(daysAhead = 30, includeExpired = false) {
  return useQuery<ExpiringDocumentsResponse>({
    queryKey: ["teachers", "documents", "expiring", daysAhead, includeExpired],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("daysAhead", String(daysAhead));
      if (includeExpired) params.set("includeExpired", "true");

      const res = await fetch(
        `/api/admin/teachers/documents/expiring?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch expiring documents");
      return res.json();
    },
    staleTime: 300_000, // Cache for 5 minutes (expiring documents don't change often)
  });
}
