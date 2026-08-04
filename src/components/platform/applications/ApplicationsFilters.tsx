"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import {
  APPLICATION_PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
} from "@/constants/application-pipeline";

// Allowed filters
const STATUS = ["all", "pending", "approved", "rejected"] as const;
const VISIBILITY = ["active", "archived"] as const;
const TYPES = ["all", "Basic", "Secondary"] as const;

function useQuerySync() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const set = (next: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(search.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v) params.delete(k);
      else params.set(k, v);
    });
    // reset cursor on filter changes
    params.delete("cursor");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return {
    search,
    set,
  };
}

export default function ApplicationsFilters() {
  const { search, set } = useQuerySync();

  const status = search.get("status") ?? "all";
  const type = search.get("type") ?? "all";
  const range = search.get("range") ?? "30d";
  const visibility = search.get("visibility") ?? "active";
  const pipelineStage = search.get("pipelineStage") ?? "all";
  const [q, setQ] = useState<string>(search.get("q") ?? "");

  // Debounce search
  useEffect(() => {
    const current = search.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => set({ q: q || null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, search]);

  const ranges = useMemo(
    () => [
      { key: "all", label: "All time" },
      { key: "7d", label: "Last 7 days" },
      { key: "30d", label: "Last 30 days" },
      { key: "90d", label: "Last 90 days" },
    ],
    []
  );

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(14,minmax(0,1fr))]">
      {/* Queue */}
      <div className="md:col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Queue
        </span>
        <Select
          value={visibility}
          onValueChange={(v) => set({ visibility: v === "active" ? null : v })}
        >
          <SelectTrigger className="bg-card border border-white/10">
            <SelectValue placeholder="Active applications" />
          </SelectTrigger>
          <SelectContent className="premiumSelectContent">
            {VISIBILITY.map((value) => (
              <SelectItem key={value} value={value} className="cursor-pointer">
                {value === "active" ? "Active applications" : "Archived applications"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Status */}
      <div className="md:col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Application status
        </span>
        <Select
          value={status}
          onValueChange={(v) => {
            set({ status: v === "all" ? null : v });
          }}
        >
          <SelectTrigger className="bg-card border border-white/10">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="premiumSelectContent">
            {STATUS.map((s) => (
              <SelectItem
                key={s}
                value={s}
                className="cursor-pointer capitalize"
              >
                {s === "all" ? "All statuses" : s === "approved" ? "Accepted" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type */}
      <div className="md:col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          School Type
        </span>
        <Select
          value={type}
          onValueChange={(v) => {
            set({ type: v === "all" ? null : v });
          }}
        >
          <SelectTrigger className="bg-card border border-white/10">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent className="premiumSelectContent">
            {TYPES.map((t) => (
              <SelectItem key={t} value={t} className="cursor-pointer">
                {t === "all" ? "All types" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline (CRM-lite) */}
      <div className="md:col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Pipeline stage
        </span>
        <Select
          value={pipelineStage}
          onValueChange={(v) => {
            set({ pipelineStage: v === "all" ? null : v });
          }}
        >
          <SelectTrigger className="bg-card border border-white/10">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent className="premiumSelectContent">
            <SelectItem value="all" className="cursor-pointer">
              All stages
            </SelectItem>
            {APPLICATION_PIPELINE_STAGES.map((s) => (
              <SelectItem key={s} value={s} className="cursor-pointer">
                {PIPELINE_STAGE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date range quick-picks */}
      <div className="md:col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Date Range
        </span>
        <Select
          value={range}
          onValueChange={(v) => {
            set({ range: v });
          }}
        >
          <SelectTrigger className="bg-card border border-white/10">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              <SelectValue placeholder="Last 30 days" />
            </div>
          </SelectTrigger>
          <SelectContent className="premiumSelectContent">
            {ranges.map((r) => (
              <SelectItem key={r.key} value={r.key} className="cursor-pointer">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="md:col-span-3 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Search
        </span>
        <Input
          className="bg-card border border-white/10"
          placeholder="Search school or admin…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Clear */}
      <div className="md:col-span-1 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted opacity-0">
          reset
        </span>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            setQ("");
            set({
              status: null,
              type: null,
              q: null,
              range: "30d",
              pipelineStage: null,
              visibility: null,
            });
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
