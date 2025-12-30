// src/components/admin/teachers/TeachersBulkActionsBar.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { X, Mail, UserCog } from "lucide-react";

export function TeachersBulkActionsBar({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  return (
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
            onClick={() => alert("Bulk invite coming next")}
          >
            <Mail className="h-4 w-4" />
            Invite
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => alert("Bulk status coming next")}
          >
            <UserCog className="h-4 w-4" />
            Change status
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={onClear}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
