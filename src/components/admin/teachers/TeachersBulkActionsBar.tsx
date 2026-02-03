// src/components/admin/teachers/TeachersBulkActionsBar.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { X, Mail, UserCog, BookOpen, Download, GraduationCap } from "lucide-react";
import { BulkChangeStatusModal } from "@/components/modals/BulkChangeStatusModal";
import { BulkAssignSubjectsModal } from "@/components/modals/BulkAssignSubjectsModal";
import { BulkAssignClassesModal } from "@/components/modals/BulkAssignClassesModal";
import { useBulkExportTeachers } from "@/hooks/admin/useTeacherBulkOperations";
import { toast } from "sonner";
import { notifyComingSoon } from "@/lib/ui/feature-notices";

export function TeachersBulkActionsBar({
  count,
  selectedIds,
  onClear,
}: {
  count: number;
  selectedIds: string[];
  onClear: () => void;
}) {
  const [statusModalOpen, setStatusModalOpen] = React.useState(false);
  const [subjectsModalOpen, setSubjectsModalOpen] = React.useState(false);
  const [classesModalOpen, setClassesModalOpen] = React.useState(false);
  const bulkExportMutation = useBulkExportTeachers();

  const handleExport = async () => {
    try {
      const blob = await bulkExportMutation.mutateAsync({
        teacherIds: selectedIds.length > 0 ? selectedIds : undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teachers-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Teachers exported successfully");
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to export teachers");
    }
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(920px,calc(100%-2rem))]">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/70 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur">
          <div className="text-sm">
            <span className="font-semibold">{count}</span>{" "}
            <span className="text-muted-foreground">selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => notifyComingSoon("Bulk invite")}
            >
              <Mail className="h-4 w-4" />
              Invite
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setSubjectsModalOpen(true)}
            >
              <BookOpen className="h-4 w-4" />
              Assign subjects
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setClassesModalOpen(true)}
            >
              <GraduationCap className="h-4 w-4" />
              Assign homeroom
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setStatusModalOpen(true)}
            >
              <UserCog className="h-4 w-4" />
              Change status
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExport}
              disabled={bulkExportMutation.isPending}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={onClear}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <BulkChangeStatusModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        teacherIds={selectedIds}
        teacherCount={count}
      />

      <BulkAssignSubjectsModal
        open={subjectsModalOpen}
        onOpenChange={setSubjectsModalOpen}
        teacherIds={selectedIds}
        teacherCount={count}
      />

      <BulkAssignClassesModal
        open={classesModalOpen}
        onOpenChange={setClassesModalOpen}
        teacherIds={selectedIds}
        teacherCount={count}
      />
    </>
  );
}
