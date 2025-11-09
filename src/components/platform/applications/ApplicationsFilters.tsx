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

// Allowed filters
const STATUS = ["all", "pending", "approved", "rejected"] as const;
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

  const status = search.get("status") ?? "pending";
  const type = search.get("type") ?? "all";
  const range = search.get("range") ?? "30d";
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
      { key: "7d", label: "Last 7 days" },
      { key: "30d", label: "Last 30 days" },
      { key: "90d", label: "Last 90 days" },
    ],
    []
  );

  return (
    <div className="grid gap-3 md:grid-cols-12">
      {/* Status */}
      <Select
        value={status}
        onValueChange={(v) => {
          set({ status: v === "all" ? null : v });
        }}
      >
        <SelectTrigger className="md:col-span-2 bg-card border border-white/10">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent className="premiumSelectContent">
          {STATUS.map((s) => (
            <SelectItem key={s} value={s} className="cursor-pointer">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type */}
      <Select
        value={type}
        onValueChange={(v) => {
          set({ type: v === "all" ? null : v });
        }}
      >
        <SelectTrigger className="md:col-span-2 bg-card border border-white/10">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent className="premiumSelectContent">
          {TYPES.map((t) => (
            <SelectItem key={t} value={t} className="cursor-pointer">
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range quick-picks */}
      <Select
        value={range}
        onValueChange={(v) => {
          set({ range: v });
        }}
      >
        <SelectTrigger className="md:col-span-2 bg-card border border-white/10">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            <SelectValue placeholder="Range" />
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

      {/* Search */}
      <Input
        className="md:col-span-5 bg-card border border-white/10"
        placeholder="Search school or admin…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {/* Clear */}
      <Button
        variant="ghost"
        className="md:col-span-1"
        onClick={() => {
          setQ("");
          set({ status: null, type: null, q: null, range: "30d" });
        }}
      >
        Reset
      </Button>
    </div>
  );
}
