"use client";

import { useMutation } from "@tanstack/react-query";
import {
  type StudentsTabId,
  type StudentsSortOrder,
  type StudentsSortBy,
} from "@/constants/students";

export type StudentExportFormat = "csv" | "xlsx";

export type ExportStudentsParams = {
  format: StudentExportFormat;
  tab: StudentsTabId;
  sortBy: StudentsSortBy;
  sortOrder: StudentsSortOrder;
  filters: {
    search?: string;
    // TODO later: classGroupId?, gradeId?, status?, etc.
  };
  selectedIds?: string[];
};

async function exportStudentsRequest(params: ExportStudentsParams) {
  const { format, tab, sortBy, sortOrder, filters, selectedIds } = params;

  const query = new URLSearchParams();
  query.set("format", format);
  query.set("tab", tab);
  query.set("sortBy", sortBy);
  query.set("sortOrder", sortOrder);

  if (filters.search) query.set("search", filters.search);
  if (selectedIds && selectedIds.length > 0) {
    // Server can treat this as "export only these"
    query.set("selectedIds", selectedIds.join(","));
  }

  const res = await fetch(`/api/admin/students/export?${query.toString()}`, {
    method: "GET",
  });

  if (!res.ok) {
    throw new Error("Failed to export students");
  }

  const blob = await res.blob();

  // Try to read filename from header, fall back to default;
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename =
    match?.[1] ??
    `students-export-${format}-${Date.now().toString()}.${format}`;

  // Create browser download
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
  return true;
}

export function useExportStudents() {
  const mutation = useMutation({
    mutationFn: exportStudentsRequest,
  });

  return {
    exportStudents: mutation.mutate,
    isExporting: mutation.isPending,
  };
}
