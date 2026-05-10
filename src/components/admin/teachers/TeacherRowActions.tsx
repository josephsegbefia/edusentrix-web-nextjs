"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  MoreHorizontal,
  Mail,
  Pencil,
  Eye,
  UserCog,
  Power,
  PowerOff,
  Trash2,
  Calendar,
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
  onUpdateLeave?: (id: string) => void;
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
  onUpdateLeave,
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
  const activateLabel = status === "on_leave" ? "End Leave" : "Activate";

  return (
    <PremiumDropdownMenu>
      <PremiumDropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 cursor-pointer rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed"
          disabled={isChangingStatus}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PremiumDropdownMenuTrigger>
      <PremiumDropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <PremiumDropdownMenuItem
          onClick={handle(onView)}
          icon={<Eye className="h-4 w-4" />}
        >
          View Profile
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuItem
          onClick={handle(onEdit)}
          icon={<Pencil className="h-3.5 w-3.5" />}
        >
          Edit details
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuItem
          onClick={handle(onManageAccess)}
          icon={<UserCog className="h-3.5 w-3.5" />}
        >
          Manage Access
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuItem
          onClick={handle(onSendMessage)}
          icon={<Mail className="h-3.5 w-3.5" />}
        >
          Send Message
        </PremiumDropdownMenuItem>

        <PremiumDropdownMenuSeparator />

        {/* Status management options */}
        {status === "on_leave" && onUpdateLeave && (
          <PremiumDropdownMenuItem
            onClick={handle(onUpdateLeave)}
            variant="warning"
            icon={<Calendar className="h-3.5 w-3.5" />}
          >
            Update leave dates
          </PremiumDropdownMenuItem>
        )}
        {canActivate && (
          <PremiumDropdownMenuItem
            onClick={handle(onActivate)}
            variant="success"
            icon={<Power className="h-3.5 w-3.5" />}
          >
            {activateLabel}
          </PremiumDropdownMenuItem>
        )}
        {canDeactivate && (
          <PremiumDropdownMenuItem
            onClick={handle(onDeactivate)}
            variant="warning"
            icon={<PowerOff className="h-3.5 w-3.5" />}
          >
            Deactivate
          </PremiumDropdownMenuItem>
        )}
        {canDelete && (
          <PremiumDropdownMenuItem
            onClick={handle(onDelete)}
            variant="destructive"
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Terminate
          </PremiumDropdownMenuItem>
        )}
      </PremiumDropdownMenuContent>
    </PremiumDropdownMenu>
  );
}
