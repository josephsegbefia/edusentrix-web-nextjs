"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function ApplicationsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [status, setStatus] = useState(sp.get("status") ?? "pending");
  const [type, setType] = useState(sp.get("type") ?? "");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  const debouncedQ = useDebounced(q, 400);

  const apply = (overrides?: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString());

    const setOrDel = (k: string, v?: string) => {
      if (v && v.trim()) params.set(k, v);
      else params.delete(k);
    };

    setOrDel("status", status);
    setOrDel("type", type);
    setOrDel("q", debouncedQ);
    setOrDel("from", from);
    setOrDel("to", to);
    setOrDel("page", "1"); // reset paging when filters change

    if (overrides) {
      Object.entries(overrides).forEach(([k, v]) => setOrDel(k, v));
    }

    router.replace(`${pathname}?${params.toString()}`);
  };

  // react to debounced search text
  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]); // only search changes automatically

  const resetDisabled = useMemo(
    () =>
      !(
        (sp.get("status") ?? "pending") !== "pending" ||
        sp.get("type") ||
        sp.get("q") ||
        sp.get("from") ||
        sp.get("to")
      ),
    [sp]
  );

  return (
    <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Status</label>
        <Select value={status} onValueChange={(v) => setStatus(v)}>
          <SelectTrigger className="bg-white text-gray-900 cursor-pointer">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="pending" className="cursor-pointer">
              Pending
            </SelectItem>
            <SelectItem value="approved" className="cursor-pointer">
              Approved
            </SelectItem>
            <SelectItem value="rejected" className="cursor-pointer">
              Rejected
            </SelectItem>
            <SelectItem value="all" className="cursor-pointer">
              All
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">School type</label>
        <Select value={type} onValueChange={(v) => setType(v)}>
          <SelectTrigger className="bg-white text-gray-900 cursor-pointer">
            <SelectValue placeholder="Any type" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="" className="cursor-pointer">
              Any
            </SelectItem>
            <SelectItem value="Basic" className="cursor-pointer">
              Basic
            </SelectItem>
            <SelectItem value="Secondary" className="cursor-pointer">
              Secondary
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="md:col-span-2">
        <label className="block text-xs text-gray-600 mb-1">Search</label>
        <Input
          placeholder="School, email, city, region…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-white text-gray-900 placeholder:text-gray-400"
        />
      </div>

      <div className="flex gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-white text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-white text-gray-900"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            onClick={() => apply()}
            className="cursor-pointer"
          >
            Apply
          </Button>
          <Button
            variant="outline"
            disabled={resetDisabled}
            onClick={() => {
              setStatus("pending");
              setType("");
              setQ("");
              setFrom("");
              setTo("");
              apply({ status: "pending", type: "", q: "", from: "", to: "" });
            }}
            className="cursor-pointer"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
