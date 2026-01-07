"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Mail,
  Pencil,
  Eye,
  UserCog,
} from "lucide-react";

type TeacherRowActionsProps = {
  id: string;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onManageAccess?: (id: string) => void;
  onSendMessage?: (id: string) => void;
};

export function TeacherRowActions({
  id,
  onView,
  onEdit,
  onManageAccess,
  onSendMessage,
}: TeacherRowActionsProps) {
  const handle =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      fn?.(id);
    };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
