"use client";

import Link from "next/link";
import { CalendarCheck2, RefreshCcw, Plus, Megaphone, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
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
  const { data } = useTeacherContext();
  const permissions = data?.data.permissions as Permission[] | undefined;
  const studioEnabled = data?.data.features?.teacherStudioEnabled ?? true;
  const canCreateAssignment = can(permissions, PERMISSIONS.assignmentsCreate);
  const canPostNotice = can(permissions, PERMISSIONS.noticesPublish);
  const showCreateAssignment = studioEnabled && canCreateAssignment;

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
        asChild
        className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
      >
        <Link href="/teacher/attendance/homeroom">
          <CalendarCheck2 className="mr-2 h-4 w-4" />
          Take Attendance
        </Link>
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
          {showCreateAssignment && (
            <PremiumDropdownMenuItem asChild icon={<ClipboardCheck className="h-4 w-4" />}>
              <Link href="/teacher/studio/assignments/new">Create Assignment</Link>
            </PremiumDropdownMenuItem>
          )}
          {canPostNotice ? (
            <PremiumDropdownMenuItem asChild icon={<Megaphone className="h-4 w-4" />}>
              <Link href="/teacher/communication/notices/new">Post Notice</Link>
            </PremiumDropdownMenuItem>
          ) : (
            <PremiumDropdownMenuItem disabled icon={<Megaphone className="h-4 w-4" />}>
              Post Notice (locked)
            </PremiumDropdownMenuItem>
          )}
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
