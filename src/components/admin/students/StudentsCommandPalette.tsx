"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GraduationCap, Plus, Upload, Search } from "lucide-react";
import type { StudentsTabId } from "@/constants/students";

type StudentsCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusSearch: () => void;
  onGoToTab: (tab: StudentsTabId) => void;
  onCreateStudent: () => void;
  onImportStudents: () => void;
};

export function StudentsCommandPalette({
  open,
  onOpenChange,
  onFocusSearch,
  onGoToTab,
  onCreateStudent,
  onImportStudents,
}: StudentsCommandPaletteProps) {
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const items = React.useMemo(
    () => [
      {
        id: "search",
        label: "Focus students search",
        hint: "/",
        icon: <Search className="h-4 w-4" />,
        action: onFocusSearch,
      },
      {
        id: "new-student",
        label: "Add a new student",
        hint: "N",
        icon: <Plus className="h-4 w-4" />,
        action: onCreateStudent,
      },
      {
        id: "import-students",
        label: "Import students from CSV",
        icon: <Upload className="h-4 w-4" />,
        action: onImportStudents,
      },
      {
        id: "tab-all",
        label: "View all students",
        icon: <GraduationCap className="h-4 w-4" />,
        action: () => onGoToTab("all"),
      },
      {
        id: "tab-fee-defaulters",
        label: "View fee defaulters",
        icon: <GraduationCap className="h-4 w-4" />,
        action: () => onGoToTab("fee-defaulters"),
      },
      {
        id: "tab-top-performers",
        label: "View top performers",
        icon: <GraduationCap className="h-4 w-4" />,
        action: () => onGoToTab("top-performers"),
      },
      {
        id: "tab-recent",
        label: "View recently added students",
        icon: <GraduationCap className="h-4 w-4" />,
        action: () => onGoToTab("recent"),
      },
    ],
    [onFocusSearch, onCreateStudent, onImportStudents, onGoToTab]
  );

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-(--ws-line) bg-(--ws-popover) p-0 text-sm text-(--ws-fg) shadow-[var(--ws-shadow)]">
        <DialogHeader className="border-b border-(--ws-line) px-4 py-3">
          <DialogTitle className="text-xs font-semibold uppercase tracking-wider text-(--ws-fg-60)">
            Students Command Palette
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 px-4 pb-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to do?"
              className={cn(
                "pl-8 pr-3 text-xs",
                "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-40)"
              )}
            />
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto pt-1 text-xs">
            {filtered.length === 0 ? (
              <li className="rounded-md bg-(--ws-fill) px-3 py-2 text-muted-foreground">
                No matching actions
              </li>
            ) : (
              filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-(--ws-fill-strong)"
                    onClick={() => {
                      item.action();
                      onOpenChange(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-(--ws-fill)">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </span>
                    {item.hint && (
                      <span className="rounded border border-(--ws-line) bg-(--ws-fill-strong) px-1.5 py-0.5 text-[10px] text-(--ws-fg-80)">
                        {item.hint}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>

          <p className="pt-1 text-[10px] text-muted-foreground/80">
            Tip: Press{" "}
            <span className="rounded bg-(--ws-fill-strong) px-1 py-0.5">Ctrl</span> +{" "}
            <span className="rounded bg-(--ws-fill-strong) px-1 py-0.5">K</span> (or{" "}
            <span className="rounded bg-(--ws-fill-strong) px-1 py-0.5">⌘</span> +{" "}
            <span className="rounded bg-(--ws-fill-strong) px-1 py-0.5">K</span>) to open
            this palette.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
