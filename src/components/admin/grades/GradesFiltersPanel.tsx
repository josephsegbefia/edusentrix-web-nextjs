"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, Check } from "lucide-react";
import {
  PremiumSelect,
  PremiumSelectTrigger,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

export type GradesFilters = {
  stage?: string;
  isActive?: boolean;
};

type GradesFiltersPanelProps = {
  open: boolean;
  onClose: () => void;
  filters: GradesFilters;
  onApply: (filters: GradesFilters) => void;
  stages?: string[];
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
      <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
        {label}
      </label>
      {children}
    </div>
  );
}

export function GradesFiltersPanel({
  open,
  onClose,
  filters,
  onApply,
  stages = ["Basic", "Lower Primary", "Upper Primary", "JHS", "SHS", "Other"],
}: GradesFiltersPanelProps) {
  const [localFilters, setLocalFilters] = React.useState<GradesFilters>({
    ...filters,
  });

  React.useEffect(() => {
    if (open) {
      setLocalFilters({ ...filters });
    }
  }, [open, filters]);

  const update = (key: keyof GradesFilters, value: string | boolean | undefined) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value === "all" || value === "" ? undefined : value,
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

  return (
    <div
      className={cn(
        "animate-in slide-in-from-top-2 fade-in-0 duration-200",
        "rounded-xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950/95 to-black/95 p-5 shadow-xl shadow-black/20 backdrop-blur-xl"
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Advanced Filters</h3>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <FilterField label="Stage">
          <PremiumSelect
            value={localFilters.stage ?? "all"}
            onValueChange={(v) => update("stage", v === "all" ? undefined : v)}
          >
            <PremiumSelectTrigger className="w-full">
              <PremiumSelectValue placeholder="All stages" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All stages</PremiumSelectItem>
              {stages.map((stage) => (
                <PremiumSelectItem key={stage} value={stage}>
                  {stage}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </FilterField>

        <FilterField label="Status">
          <PremiumSelect
            value={
              localFilters.isActive === undefined
                ? "all"
                : localFilters.isActive
                ? "active"
                : "inactive"
            }
            onValueChange={(v) => {
              if (v === "all") update("isActive", undefined);
              else update("isActive", v === "active");
            }}
          >
            <PremiumSelectTrigger className="w-full">
              <PremiumSelectValue placeholder="All statuses" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
              <PremiumSelectItem value="active">Active only</PremiumSelectItem>
              <PremiumSelectItem value="inactive">Inactive only</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </FilterField>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1.5 text-white/60 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          className="gap-1.5 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
        >
          <Check className="h-3.5 w-3.5" />
          Apply
        </Button>
      </div>
    </div>
  );
}
