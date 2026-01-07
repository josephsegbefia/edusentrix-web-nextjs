/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/admin/teachers/TeachersAdvancedFiltersDialog.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type IdName = { id: string; name: string };

type FiltersValue = {
  subjectId: string;
  classGroupId: string;
  department: string;
};

async function fetchList(url: string): Promise<IdName[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();

  // flexible parsing: { data: [...] } or [...]
  const arr = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json)
    ? json
    : [];
  return arr
    .map((x: any) => ({
      id: String(x.id || x._id),
      name: String(x.name || x.title || ""),
    }))
    .filter((x: IdName) => x.id && x.name);
}

export function TeachersAdvancedFiltersDialog({
  open,
  onOpenChange,
  value,
  onChange,
  onClear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: FiltersValue;
  onChange: (next: FiltersValue) => void;
  onClear: () => void;
}) {
  const [subjects, setSubjects] = React.useState<IdName[]>([]);
  const [classGroups, setClassGroups] = React.useState<IdName[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 🔧 Adjust these if your routes differ
        const [s, g] = await Promise.all([
          fetchList("/api/admin/subjects?limit=500"),
          fetchList("/api/admin/class-groups?limit=500"),
        ]);
        if (!cancelled) {
          setSubjects(s);
          setClassGroups(g);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const subjectLabel =
    subjects.find((s) => s.id === value.subjectId)?.name || "Any";
  const groupLabel =
    classGroups.find((g) => g.id === value.classGroupId)?.name || "Any";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-xl shadow-black/30 backdrop-blur">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Department
            </p>
            <Input
              value={value.department}
              onChange={(e) =>
                onChange({ ...value, department: e.target.value })
              }
              placeholder="e.g. Mathematics"
              className="mt-2"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Subject
              </p>
              <select
                className="mt-2 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
                value={value.subjectId}
                onChange={(e) =>
                  onChange({ ...value, subjectId: e.target.value })
                }
                disabled={loading}
              >
                <option value="">{loading ? "Loading…" : "Any"}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Current: {subjectLabel}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Homeroom Class
              </p>
              <select
                className="mt-2 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm"
                value={value.classGroupId}
                onChange={(e) =>
                  onChange({ ...value, classGroupId: e.target.value })
                }
                disabled={loading}
              >
                <option value="">{loading ? "Loading…" : "Any"}</option>
                {classGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Current: {groupLabel}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClear}>
            Clear
          </Button>
          <Button onClick={() => onOpenChange(false)}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
