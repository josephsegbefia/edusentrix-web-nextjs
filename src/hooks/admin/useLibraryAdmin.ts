"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type {
  createLibraryBookSchema,
  createLibraryBookCopyBodySchema,
  issueLibraryLoanSchema,
  listLibraryBooksQuerySchema,
  listLibraryLoansQuerySchema,
  markLibraryLoanDispositionBodySchema,
  patchLibrarySettingsSchema,
  renewLibraryLoanSchema,
  returnLibraryLoanSchema,
  updateLibraryBookCopySchema,
  updateLibraryBookSchema,
  waiveLibraryLoanFineSchema,
} from "@/lib/library/library.validators";
import {
  libraryImportBodySchema,
  libraryReportQuerySchema,
  listLibraryReservationsQuerySchema,
  createLibraryReservationBodySchema,
} from "@/lib/library/library.validators";
import {
  TERMINAL_LIBRARY_IMPORT_STATUSES,
  type SerializedLibraryImportJob,
} from "@/lib/library/library-import.shared";
import type { LibraryBorrowerSearchHit } from "@/lib/library/library-borrower.service";
import type { LibraryCapabilities } from "@/lib/library/library-capabilities";
import type { LibraryDashboardDTO } from "@/lib/library/library-dashboard.service";
import type { LibraryLoanListDTO } from "@/lib/library/library.serialize";

import type { LibraryReportResult } from "@/lib/library/library-report.service";
import type { LibraryReservationListDTO } from "@/lib/library/library-reservation.service";
import type { ILibraryImportJob } from "@/models/LibraryImportJob";

export const libraryAdminKeys = {
  root: ["admin-library"] as const,
  capabilities: () => [...libraryAdminKeys.root, "capabilities"] as const,
  dashboard: () => [...libraryAdminKeys.root, "dashboard"] as const,
  booksList: (q: string) => [...libraryAdminKeys.root, "books", q] as const,
  book: (id: string) => [...libraryAdminKeys.root, "book", id] as const,
  copies: (bookId: string, inc: boolean) =>
    [...libraryAdminKeys.root, "copies", bookId, inc ? "1" : "0"] as const,
  settings: () => [...libraryAdminKeys.root, "settings"] as const,
  loansList: (q: string) => [...libraryAdminKeys.root, "loans", q] as const,
  report: (q: string) => [...libraryAdminKeys.root, "report", q] as const,
  importJob: (id: string) => [...libraryAdminKeys.root, "import", id] as const,
  borrowerLoans: (t: string, id: string, q: string) =>
    [...libraryAdminKeys.root, "borrower-loans", t, id, q] as const,
  noticesList: (q: string) => [...libraryAdminKeys.root, "notices", q] as const,
  reservationsList: (q: string) => [...libraryAdminKeys.root, "reservations", q] as const,
};

export type LibraryBookDTO = {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  status: string;
  coverImageUrl?: string;
  coverImageKey?: string;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  tags: string[];
  updatedAt: string;
};

export type LibraryBooksListResponse = {
  success: boolean;
  data?: {
    items: LibraryBookDTO[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
};

export type LibraryBookResponse = {
  success: boolean;
  data?: LibraryBookDTO & Record<string, unknown>;
};

export type LibraryCopyDTO = {
  id: string;
  bookId: string;
  copyCode: string;
  barcode?: string;
  qrCode?: string;
  status: string;
  condition: string;
  shelfLocation?: string;
  updatedAt: string;
};

export type LibraryCopiesResponse = {
  success: boolean;
  data?: { items: LibraryCopyDTO[] };
};

export type LibrarySettingsDTO = Record<string, unknown>;

export type LibraryCapabilitiesResponse = {
  success: boolean;
  data?: LibraryCapabilities;
  error?: { message?: string };
};

export type LibraryDashboardResponse = {
  success: boolean;
  data?: LibraryDashboardDTO;
};

export type LibraryLoansListResponse = {
  success: boolean;
  data?: {
    items: LibraryLoanListDTO[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
};

export type LibraryBorrowersSearchResponse = {
  success: boolean;
  data?: { items: LibraryBorrowerSearchHit[] };
};

function loansQueryString(params: z.infer<typeof listLibraryLoansQuerySchema>) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("limit", String(params.limit));
  sp.set("bucket", params.bucket);
  sp.set("sortBy", params.sortBy);
  sp.set("sortOrder", params.sortOrder);
  return sp.toString();
}

export function useLibraryCapabilitiesQuery() {
  return useQuery<LibraryCapabilitiesResponse>({
    queryKey: libraryAdminKeys.capabilities(),
    queryFn: async () => {
      const res = await fetch("/api/admin/library/capabilities", { cache: "no-store" });
      return res.json();
    },
  });
}

export type LibraryNoticeAdminDTO = {
  id: string;
  title: string;
  message: string;
  audience: string;
  audienceRefId?: string;
  status: string;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  updatedBy?: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LibraryNoticesListResponse = {
  success: boolean;
  data?: {
    items: LibraryNoticeAdminDTO[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
};

function libraryNoticesQueryString(page: number, limit: number, status: string) {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("limit", String(limit));
  sp.set("status", status);
  return sp.toString();
}

export function useLibraryNoticesAdminQuery(
  page: number,
  limit: number,
  status: string,
  enabled: boolean
) {
  const qs = libraryNoticesQueryString(page, limit, status);
  return useQuery<LibraryNoticesListResponse>({
    queryKey: libraryAdminKeys.noticesList(qs),
    queryFn: async () => {
      const res = await fetch(`/api/admin/library/notices?${qs}`, { cache: "no-store" });
      return res.json();
    },
    enabled,
  });
}

export function useLibraryNoticeCreateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title: string;
      message: string;
      audience: string;
      audienceRefId?: string;
      expiresAt?: string | null;
      status?: "draft" | "published";
    }) => {
      const res = await fetch("/api/admin/library/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to create notice");
      }
      return json as { success: boolean; data?: LibraryNoticeAdminDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });
}

export function useLibraryNoticeUpdateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      noticeId: string;
      body: Partial<{
        title: string;
        message: string;
        audience: string;
        audienceRefId: string;
        expiresAt: string | null;
        status: "draft" | "published" | "archived";
      }>;
    }) => {
      const res = await fetch(`/api/admin/library/notices/${args.noticeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to update notice");
      }
      return json as { success: boolean; data?: LibraryNoticeAdminDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });
}

export function useLibraryDashboardQuery() {
  return useQuery<LibraryDashboardResponse>({
    queryKey: libraryAdminKeys.dashboard(),
    queryFn: async () => {
      const res = await fetch("/api/admin/library/dashboard", { cache: "no-store" });
      return res.json();
    },
  });
}

export function useLibraryLoansQuery(params: z.infer<typeof listLibraryLoansQuerySchema>) {
  const qs = loansQueryString(params);
  return useQuery<LibraryLoansListResponse>({
    queryKey: libraryAdminKeys.loansList(qs),
    queryFn: async () => {
      const res = await fetch(`/api/admin/library/loans?${qs}`, { cache: "no-store" });
      return res.json();
    },
  });
}

export function useLibraryBorrowersSearch(
  q: string,
  types: string,
  limit: number,
  enabled: boolean
) {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());
  qs.set("types", types);
  qs.set("limit", String(limit));
  const s = qs.toString();
  return useQuery<LibraryBorrowersSearchResponse>({
    queryKey: [...libraryAdminKeys.root, "borrowers", s] as const,
    queryFn: async () => {
      const res = await fetch(`/api/admin/library/borrowers/search?${s}`, {
        cache: "no-store",
      });
      return res.json();
    },
    enabled,
  });
}

function booksQueryString(params: z.infer<typeof listLibraryBooksQuerySchema>) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("limit", String(params.limit));
  if (params.search?.trim()) sp.set("search", params.search.trim());
  sp.set("status", params.status);
  sp.set("sortBy", params.sortBy);
  sp.set("sortOrder", params.sortOrder);
  return sp.toString();
}

export function useLibraryBooksQuery(params: z.infer<typeof listLibraryBooksQuerySchema>) {
  const qs = booksQueryString(params);
  return useQuery<LibraryBooksListResponse>({
    queryKey: libraryAdminKeys.booksList(qs),
    queryFn: async () => {
      const res = await fetch(`/api/admin/library/books?${qs}`, { cache: "no-store" });
      return res.json();
    },
  });
}

export function useLibraryBookQuery(bookId: string | undefined) {
  return useQuery<LibraryBookResponse>({
    queryKey: libraryAdminKeys.book(bookId || ""),
    queryFn: async () => {
      const res = await fetch(`/api/admin/library/books/${bookId}`, {
        cache: "no-store",
      });
      return res.json();
    },
    enabled: Boolean(bookId),
  });
}

export function useLibraryCopiesQuery(bookId: string | undefined, includeArchived = false) {
  return useQuery<LibraryCopiesResponse>({
    queryKey: libraryAdminKeys.copies(bookId || "", includeArchived),
    queryFn: async () => {
      const sp = includeArchived ? "?includeArchived=1" : "";
      const res = await fetch(`/api/admin/library/books/${bookId}/copies${sp}`, {
        cache: "no-store",
      });
      return res.json();
    },
    enabled: Boolean(bookId),
  });
}

export function useLibrarySettingsQuery() {
  return useQuery<{ success: boolean; data?: LibrarySettingsDTO }>({
    queryKey: libraryAdminKeys.settings(),
    queryFn: async () => {
      const res = await fetch("/api/admin/library/settings", { cache: "no-store" });
      return res.json();
    },
  });
}

type CreateBook = z.infer<typeof createLibraryBookSchema>;
type UpdateBook = z.infer<typeof updateLibraryBookSchema>;
type CreateCopy = z.infer<typeof createLibraryBookCopyBodySchema>;
type UpdateCopy = z.infer<typeof updateLibraryBookCopySchema>;
type PatchSettings = z.infer<typeof patchLibrarySettingsSchema>;
type IssueLoanBody = z.infer<typeof issueLibraryLoanSchema>;
type ReturnLoanBody = z.infer<typeof returnLibraryLoanSchema>;
type RenewLoanBody = z.infer<typeof renewLibraryLoanSchema>;
type WaiveLoanFineBody = z.infer<typeof waiveLibraryLoanFineSchema>;
type MarkLoanDispositionBody = z.infer<typeof markLibraryLoanDispositionBodySchema>;
type LibraryImportBody = z.infer<typeof libraryImportBodySchema>;
type LibraryReportParams = z.infer<typeof libraryReportQuerySchema>;

function reportQueryString(params: LibraryReportParams) {
  const sp = new URLSearchParams();
  sp.set("type", params.type);
  if (params.from) sp.set("from", params.from.toISOString());
  if (params.to) sp.set("to", params.to.toISOString());
  if (params.classGroupId?.trim()) sp.set("classGroupId", params.classGroupId.trim());
  if (params.gradeLevelId?.trim()) sp.set("gradeLevelId", params.gradeLevelId.trim());
  if (params.limit != null) sp.set("limit", String(params.limit));
  return sp.toString();
}

export type LibraryImportEnqueueResponse = {
  success: boolean;
  data: SerializedLibraryImportJob;
  jobId: string;
};

export type LibraryImportJobQueryResponse = {
  success: boolean;
  data?: SerializedLibraryImportJob;
  error?: { message?: string };
};

export function useLibraryImportJobQuery(jobId: string | null) {
  return useQuery<LibraryImportJobQueryResponse>({
    queryKey: libraryAdminKeys.importJob(jobId || ""),
    queryFn: async () => {
      const res = await fetch(`/api/admin/library/imports/${jobId}`, { cache: "no-store" });
      return res.json() as Promise<LibraryImportJobQueryResponse>;
    },
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const status = q.state.data?.data?.status;
      if (
        !status ||
        TERMINAL_LIBRARY_IMPORT_STATUSES.has(status as ILibraryImportJob["status"])
      ) {
        return false;
      }
      return 2000;
    },
  });
}

export function useLibraryReportQuery(params: LibraryReportParams, enabled = true) {
  const qs = reportQueryString(params);
  return useQuery<{ success: boolean; data?: LibraryReportResult }>({
    queryKey: libraryAdminKeys.report(qs),
    queryFn: async () => {
      const res = await fetch(`/api/admin/library/reports?${qs}`, { cache: "no-store" });
      return res.json();
    },
    enabled,
  });
}

export function useLibraryImportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LibraryImportBody) => {
      const res = await fetch("/api/admin/library/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as LibraryImportEnqueueResponse & {
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(json?.error?.message || "Import failed");
      }
      if (res.status !== 202 || !json.jobId) {
        throw new Error("Unexpected response from import enqueue");
      }
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });
}

type ListLibraryReservationsParams = z.infer<typeof listLibraryReservationsQuerySchema>;

function reservationsQueryString(params: ListLibraryReservationsParams) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("limit", String(params.limit));
  if (params.bookId?.trim()) sp.set("bookId", params.bookId.trim());
  if (params.borrowerType) sp.set("borrowerType", params.borrowerType);
  if (params.borrowerId?.trim()) sp.set("borrowerId", params.borrowerId.trim());
  if (params.status) sp.set("status", params.status);
  return sp.toString();
}

export type LibraryReservationsListResponse = {
  success: boolean;
  data?: {
    items: LibraryReservationListDTO[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
};

export function useLibraryReservationsQuery(
  params: ListLibraryReservationsParams,
  enabled = true
) {
  const qs = reservationsQueryString(params);
  return useQuery<LibraryReservationsListResponse>({
    queryKey: libraryAdminKeys.reservationsList(qs),
    queryFn: async () => {
      const res = await fetch(`/api/admin/library/reservations?${qs}`, { cache: "no-store" });
      return res.json();
    },
    enabled,
  });
}

type CreateReservationBody = z.infer<typeof createLibraryReservationBodySchema>;

export function useLibraryReservationCreateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateReservationBody) => {
      const res = await fetch("/api/admin/library/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to create reservation");
      }
      return json as { success: boolean; data: LibraryReservationListDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });
}

export function useLibraryReservationCancelMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) => {
      const res = await fetch(`/api/admin/library/reservations/${reservationId}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to cancel");
      }
      return json as { success: boolean; data: LibraryReservationListDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });
}

export function useLibraryReservationFulfillMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) => {
      const res = await fetch(`/api/admin/library/reservations/${reservationId}/fulfill`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to fulfill");
      }
      return json as {
        success: boolean;
        data: { reservation: LibraryReservationListDTO; loan: LibraryLoanListDTO | null };
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });
}

export function useBorrowerHistoryQuery(
  borrowerType: string | undefined,
  borrowerId: string | undefined,
  page: number,
  limit: number
) {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("limit", String(limit));
  const qs = sp.toString();
  const enabled = Boolean(borrowerType && borrowerId);
  return useQuery<LibraryLoansListResponse>({
    queryKey: libraryAdminKeys.borrowerLoans(borrowerType || "", borrowerId || "", qs),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/library/borrowers/${borrowerType}/${borrowerId}/loans?${qs}`,
        { cache: "no-store" }
      );
      return res.json();
    },
    enabled,
  });
}

export function useLibrarySendOverdueRemindersMutation() {
  return useMutation({
    mutationFn: async (body: { loanIds: string[]; message?: string }) => {
      const res = await fetch("/api/admin/library/overdue/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Reminder request failed");
      }
      return json as { success: boolean; data?: { enqueued: number; skippedLoans: number } };
    },
  });
}

export function useLibraryBookMutations() {
  const qc = useQueryClient();

  const createBook = useMutation({
    mutationFn: async (body: CreateBook) => {
      const res = await fetch("/api/admin/library/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to create book");
      }
      return json as LibraryBookResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  const updateBook = useMutation({
    mutationFn: async ({ bookId, body }: { bookId: string; body: UpdateBook }) => {
      const res = await fetch(`/api/admin/library/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to update book");
      }
      return json as LibraryBookResponse;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.book(v.bookId) });
    },
  });

  const createCopy = useMutation({
    mutationFn: async ({ bookId, body }: { bookId: string; body: CreateCopy }) => {
      const res = await fetch(`/api/admin/library/books/${bookId}/copies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to add copy");
      }
      return json;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.copies(v.bookId, false) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.copies(v.bookId, true) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.book(v.bookId) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  const updateCopy = useMutation({
    mutationFn: async ({
      copyId,
      bookId,
      body,
    }: {
      copyId: string;
      bookId: string;
      body: UpdateCopy;
    }) => {
      const res = await fetch(`/api/admin/library/copies/${copyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to update copy");
      }
      return json;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.copies(v.bookId, false) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.copies(v.bookId, true) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.book(v.bookId) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  const patchSettings = useMutation({
    mutationFn: async (body: PatchSettings) => {
      const res = await fetch("/api/admin/library/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to update settings");
      }
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.settings() });
    },
  });

  const generateCopyCodes = useMutation({
    mutationFn: async ({ copyId, bookId }: { copyId: string; bookId: string }) => {
      const res = await fetch(`/api/admin/library/copies/${copyId}/generate-code`, {
        method: "POST",
      });
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to generate codes");
      }
      return { copyId, bookId, json };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.copies(v.bookId, false) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.copies(v.bookId, true) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.book(v.bookId) });
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  return { createBook, updateBook, createCopy, updateCopy, generateCopyCodes, patchSettings };
}

export function useLibraryLoanMutations() {
  const qc = useQueryClient();

  const issueLoan = useMutation({
    mutationFn: async (body: IssueLoanBody) => {
      const res = await fetch("/api/admin/library/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to issue loan");
      }
      return json as { success: boolean; data: LibraryLoanListDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  const returnLoan = useMutation({
    mutationFn: async ({ loanId, body }: { loanId: string; body: ReturnLoanBody }) => {
      const res = await fetch(`/api/admin/library/loans/${loanId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to return loan");
      }
      return json as { success: boolean; data: LibraryLoanListDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  const renewLoan = useMutation({
    mutationFn: async ({ loanId, body }: { loanId: string; body: RenewLoanBody }) => {
      const res = await fetch(`/api/admin/library/loans/${loanId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to renew loan");
      }
      return json as { success: boolean; data: LibraryLoanListDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  const waiveFine = useMutation({
    mutationFn: async ({
      loanId,
      body,
    }: {
      loanId: string;
      body: WaiveLoanFineBody;
    }) => {
      const res = await fetch(`/api/admin/library/loans/${loanId}/waive-fine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to waive fine");
      }
      return json as { success: boolean; data: LibraryLoanListDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  const markLoanLost = useMutation({
    mutationFn: async ({
      loanId,
      body = {},
    }: {
      loanId: string;
      body?: MarkLoanDispositionBody;
    }) => {
      const res = await fetch(`/api/admin/library/loans/${loanId}/mark-lost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to mark lost");
      }
      return json as { success: boolean; data: LibraryLoanListDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  const markLoanDamaged = useMutation({
    mutationFn: async ({
      loanId,
      body = {},
    }: {
      loanId: string;
      body?: MarkLoanDispositionBody;
    }) => {
      const res = await fetch(`/api/admin/library/loans/${loanId}/mark-damaged`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to mark damaged");
      }
      return json as { success: boolean; data: LibraryLoanListDTO };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryAdminKeys.root });
    },
  });

  return { issueLoan, returnLoan, renewLoan, waiveFine, markLoanLost, markLoanDamaged };
}
