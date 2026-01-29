"use client";

import Link from "next/link";
import { CalendarCheck2, RefreshCcw, Plus, Megaphone, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";

type QuickActionsProps = {
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function QuickActions({ onRefresh, refreshing }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        onClick={onRefresh}
        disabled={!onRefresh || refreshing}
        className="border border-white/10 bg-white/10 text-white hover:bg-white/20"
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
      <Button
        type="button"
        disabled
        className="border border-white/10 bg-white/5 text-white/40"
      >
        <CalendarCheck2 className="mr-2 h-4 w-4" />
        Take Attendance
      </Button>

      <PremiumDropdownMenu>
        <PremiumDropdownMenuTrigger asChild>
          <Button
            type="button"
            className="border border-white/10 bg-card/90 text-white hover:bg-white/10"
          >
            <Plus className="mr-2 h-4 w-4" />
            More Actions
          </Button>
        </PremiumDropdownMenuTrigger>
        <PremiumDropdownMenuContent align="end">
          <PremiumDropdownMenuItem disabled icon={<ClipboardCheck className="h-4 w-4" />}>
            Create Assignment (soon)
          </PremiumDropdownMenuItem>
          <PremiumDropdownMenuItem disabled icon={<Megaphone className="h-4 w-4" />}>
            Post Notice (soon)
          </PremiumDropdownMenuItem>
          <PremiumDropdownMenuSeparator />
          <PremiumDropdownMenuItem asChild>
            <Link href="/teacher">
              <span className="flex items-center gap-2">
                Open Dashboard
              </span>
            </Link>
          </PremiumDropdownMenuItem>
        </PremiumDropdownMenuContent>
      </PremiumDropdownMenu>
    </div>
  );
}
