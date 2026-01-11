"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Mail,
  Pencil,
  Eye,
  UserCog,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import type { TeacherStatus } from "@/types/admin/teacher";

type TeacherRowActionsProps = {
  id: string;
  status?: TeacherStatus;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onManageAccess?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onActivate?: (id: string) => void;
  onDeactivate?: (id: string) => void;
  onDelete?: (id: string) => void;
  isChangingStatus?: boolean;
};

export function TeacherRowActions({
  id,
  status = "active",
  onView,
  onEdit,
  onManageAccess,
  onSendMessage,
  onActivate,
  onDeactivate,
  onDelete,
  isChangingStatus,
}: TeacherRowActionsProps) {
  const handle =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      fn?.(id);
    };

  const canActivate = status === "inactive" || status === "terminated" || status === "on_leave";
  const canDeactivate = status === "active";
  const canDelete = status !== "terminated";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          disabled={isChangingStatus}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] border border-white/10 bg-slate-950/95 text-xs text-slate-50"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem onClick={handle(onView)}>
          <Eye className="h-4 w-4 mr-2" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handle(onEdit)}>
          <Pencil className="h-3.5 w-3.5 mr-2" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handle(onManageAccess)}>
          <UserCog className="h-3.5 w-3.5 mr-2" />
          Manage Access
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handle(onSendMessage)}>
          <Mail className="h-3.5 w-3.5 mr-2" />
          Send Message
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/10" />

        {/* Status management options */}
        {canActivate && (
          <DropdownMenuItem
            onClick={handle(onActivate)}
            className="text-emerald-300 focus:text-emerald-200 focus:bg-emerald-500/10"
          >
            <Power className="h-3.5 w-3.5 mr-2" />
            Activate
          </DropdownMenuItem>
        )}
        {canDeactivate && (
          <DropdownMenuItem
            onClick={handle(onDeactivate)}
            className="text-amber-300 focus:text-amber-200 focus:bg-amber-500/10"
          >
            <PowerOff className="h-3.5 w-3.5 mr-2" />
            Deactivate
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            onClick={handle(onDelete)}
            className="text-red-300 focus:text-red-200 focus:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Terminate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
