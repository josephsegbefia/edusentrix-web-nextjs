"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, Check } from "lucide-react";
import { useGrades, type GradeDTO } from "@/hooks/admin/useGrades";
import type { StudentsFilters } from "@/hooks/admin/useStudents";
import {
  PremiumSelect,
  PremiumSelectTrigger,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";

type StudentsFiltersPanelProps = {
  open: boolean;
  onClose: () => void;
  filters: StudentsFilters;
  onApply: (filters: StudentsFilters) => void;
};

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-(--ws-fg-40)">
        {label}
      </label>
      {children}
    </div>
  );
}

export function StudentsFiltersPanel({
  open,
  onClose,
  filters,
  onApply,
}: StudentsFiltersPanelProps) {
  const { data: gradesResponse } = useGrades(true);
  const grades: GradeDTO[] = gradesResponse?.data ?? [];

  const [localFilters, setLocalFilters] = React.useState<StudentsFilters>({
    ...filters,
  });

  React.useEffect(() => {
    if (open) {
      setLocalFilters({ ...filters });
    }
  }, [open, filters]);

  const update = (key: keyof StudentsFilters, value: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value === "all" || value === "" ? undefined : value,
    }));
  };

  const updateDate = (key: "enrollmentFrom" | "enrollmentTo", date: Date | null) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: date ? date.toISOString().split("T")[0] : undefined,
    }));
  };

  const handleReset = () => {
    setLocalFilters({});
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const activeFilterCount = Object.values(localFilters).filter(
    (v) => v !== undefined && v !== "" && v !== "all"
  ).length;

  if (!open) return null;

  const enrollmentFromDate = localFilters.enrollmentFrom
    ? new Date(localFilters.enrollmentFrom)
    : null;
  const enrollmentToDate = localFilters.enrollmentTo
    ? new Date(localFilters.enrollmentTo)
    : null;

  return (
    <div
      className={cn(
        "animate-in slide-in-from-top-2 fade-in-0 duration-200",
        "rounded-xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) p-5 shadow-[var(--ws-shadow)] backdrop-blur-xl"
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-(--ws-fg)">Advanced Filters</h3>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-medium text-(--ws-teal)">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-(--ws-fg-40) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Filter grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Status */}
        <FilterField label="Status">
          <PremiumSelect
            value={localFilters.status || "all"}
            onValueChange={(v) => update("status", v)}
          >
            <PremiumSelectTrigger className="h-9 rounded-xl text-sm">
              <PremiumSelectValue placeholder="All statuses" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
              <PremiumSelectItem value="active">Active</PremiumSelectItem>
              <PremiumSelectItem value="inactive">Inactive</PremiumSelectItem>
              <PremiumSelectItem value="withdrawn">Withdrawn</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </FilterField>

        {/* Gender */}
        <FilterField label="Gender">
          <PremiumSelect
            value={localFilters.gender || "all"}
            onValueChange={(v) => update("gender", v)}
          >
            <PremiumSelectTrigger className="h-9 rounded-xl text-sm">
              <PremiumSelectValue placeholder="All genders" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All genders</PremiumSelectItem>
              <PremiumSelectItem value="male">Male</PremiumSelectItem>
              <PremiumSelectItem value="female">Female</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </FilterField>

        {/* Grade */}
        <FilterField label="Grade">
          <PremiumSelect
            value={localFilters.gradeId || "all"}
            onValueChange={(v) => update("gradeId", v)}
          >
            <PremiumSelectTrigger className="h-9 rounded-xl text-sm">
              <PremiumSelectValue placeholder="All grades" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All grades</PremiumSelectItem>
              {grades.map((g) => (
                <PremiumSelectItem key={g.id} value={g.id}>
                  {g.name}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </FilterField>

        {/* Fee Status */}
        <FilterField label="Fee Status">
          <PremiumSelect
            value={localFilters.feeStatus || "all"}
            onValueChange={(v) => update("feeStatus", v)}
          >
            <PremiumSelectTrigger className="h-9 rounded-xl text-sm">
              <PremiumSelectValue placeholder="All fee statuses" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All fee statuses</PremiumSelectItem>
              <PremiumSelectItem value="cleared">Cleared</PremiumSelectItem>
              <PremiumSelectItem value="owing">Owing</PremiumSelectItem>
              <PremiumSelectItem value="partial">Partial</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </FilterField>

        {/* Enrolled From */}
        <FilterField label="Enrolled From">
          <CustomDatePicker
            value={enrollmentFromDate}
            onChange={(d) => updateDate("enrollmentFrom", d)}
            placeholder="Select start date"
            maxDate={enrollmentToDate || undefined}
            surface="theme"
          />
        </FilterField>

        {/* Enrolled To */}
        <FilterField label="Enrolled To">
          <CustomDatePicker
            value={enrollmentToDate}
            onChange={(d) => updateDate("enrollmentTo", d)}
            placeholder="Select end date"
            minDate={enrollmentFromDate || undefined}
            surface="theme"
          />
        </FilterField>
      </div>

      {/* Footer */}
      <div className="mt-5 flex flex-col gap-2 border-t border-(--ws-line) pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-2 text-xs text-(--ws-fg-50) hover:text-(--ws-fg)"
        >
          <RotateCcw className="h-3 w-3" />
          Reset all
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70) hover:bg-(--ws-fill-strong)"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="gap-2 bg-linear-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
          >
            <Check className="h-3.5 w-3.5" />
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
