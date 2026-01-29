"use client";

import { Button } from "@/components/ui/button";
import { Copy, UserCheck, UserX } from "lucide-react";

export function BulkActions({
  onMarkAllPresent,
  onMarkAllAbsent,
  onCopyYesterday,
  loading,
}: {
  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;
  onCopyYesterday: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onMarkAllPresent}
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
      >
        <UserCheck className="h-4 w-4" />
        Mark All Present
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onMarkAllAbsent}
        className="border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
      >
        <UserX className="h-4 w-4" />
        Mark All Absent
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onCopyYesterday}
        disabled={loading}
        className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
      >
        <Copy className="h-4 w-4" />
        Same as Yesterday
      </Button>
    </div>
  );
}
