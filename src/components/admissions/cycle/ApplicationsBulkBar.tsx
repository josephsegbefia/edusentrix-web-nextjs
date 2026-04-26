"use client";

import * as React from "react";
import { Download, Loader2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import {
  exportApplicationsToCsv,
  useBulkUpdateApplications,
} from "@/hooks/admissions/useAdmissionApplications";

const STATUS_CHOICES: Array<{
  value:
    | "submitted"
    | "under_review"
    | "interview_scheduled"
    | "waitlisted"
    | "expired";
  label: string;
}> = [
  { value: "submitted", label: "New" },
  { value: "under_review", label: "Under review" },
  { value: "interview_scheduled", label: "Interview scheduled" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "expired", label: "Expired" },
];

type ApplicationsBulkBarProps = {
  selectedIds: string[];
  onClearSelection: () => void;
};

export function ApplicationsBulkBar({
  selectedIds,
  onClearSelection,
}: ApplicationsBulkBarProps) {
  const bulk = useBulkUpdateApplications();
  const [exporting, setExporting] = React.useState(false);
  const [statusValue, setStatusValue] = React.useState<string>("");

  if (selectedIds.length === 0) return null;

  function handleApplyStatus(value: string) {
    setStatusValue(value);
    bulk.mutate(
      {
        ids: selectedIds,
        action: "set_status",
        status: value as (typeof STATUS_CHOICES)[number]["value"],
      },
      {
        onSuccess: (res) => {
          toast.success(
            `${res.data.updated} updated${
              res.data.skipped > 0 ? ` · ${res.data.skipped} skipped` : ""
            }`
          );
          onClearSelection();
          setStatusValue("");
        },
        onError: (err) => toast.error(err.message || "Bulk update failed"),
      }
    );
  }

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await exportApplicationsToCsv({ ids: selectedIds });
      toast.success(`Exported ${rows} application${rows === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-40",
        "sm:left-4 sm:right-4 md:left-6 md:right-6 lg:left-[260px] lg:right-6"
      )}
    >
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-100">
              <Users className="h-3.5 w-3.5" />
              {selectedIds.length} selected
            </div>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PremiumSelect
              value={statusValue}
              onValueChange={handleApplyStatus}
              disabled={bulk.isPending}
            >
              <PremiumSelectTrigger className="h-9 w-56">
                <PremiumSelectValue placeholder="Change status to…" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {STATUS_CHOICES.map((s) => (
                  <PremiumSelectItem key={s.value} value={s.value}>
                    {s.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || bulk.isPending}
              className="h-9 border-white/10 bg-white/5 text-white"
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Export CSV
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          Decisions, withdrawals and provisioning are intentionally excluded
          from bulk actions to keep the audit trail clean.
        </p>
      </div>
    </div>
  );
}
