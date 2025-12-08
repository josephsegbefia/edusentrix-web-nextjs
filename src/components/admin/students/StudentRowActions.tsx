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
  UserPlus,
  CreditCard,
  Eye,
} from "lucide-react";

type StudentRowActionsProps = {
  id: string;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignClass?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onRecordPayment?: (id: string) => void;
};

export function StudentRowActions({
  id,
  onView,
  onEdit,
  onAssignClass,
  onSendMessage,
  onRecordPayment,
}: StudentRowActionsProps) {
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
        <DropdownMenuItem onClick={handle(onAssignClass)}>
          <UserPlus className="h-3.5 w-3.5 mr-2" />
          Assign / Change Class
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handle(onRecordPayment)}>
          <CreditCard className="h-3.5 w-3.5 mr-2" />
          Record Payment
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handle(onRecordPayment)}>
          <Mail className="h-3.5 w-3.5 mr-2" />
          Message Parent
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
